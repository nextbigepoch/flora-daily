#!/usr/bin/env python3
"""Send Flora Daily to a Feishu custom bot webhook."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "content" / "daily-brief.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Push Flora Daily to Feishu.")
    parser.add_argument("--source", default=str(DEFAULT_SOURCE), help="Markdown or JSON brief source.")
    parser.add_argument("--format", choices=["card", "text"], default="card", help="Feishu message format.")
    parser.add_argument("--page-url", default=os.getenv("FLORA_DAILY_PAGE_URL", ""), help="Optional public page URL.")
    parser.add_argument("--pdf-url", default=os.getenv("FLORA_DAILY_PDF_URL", ""), help="Optional public PDF URL.")
    parser.add_argument("--image-url", default=os.getenv("FLORA_DAILY_IMAGE_URL", ""), help="Optional public screenshot URL.")
    parser.add_argument("--dry-run", action="store_true", help="Print payload without sending.")
    args = parser.parse_args()

    source = Path(args.source)
    brief = load_brief(source)
    links = {
        "page": args.page_url,
        "pdf": args.pdf_url,
        "image": args.image_url,
    }
    payload = build_card_payload(brief, links) if args.format == "card" else build_text_payload(brief, links)
    apply_signature(payload)

    if args.dry_run:
      print(json.dumps(payload, ensure_ascii=False, indent=2))
      return 0

    webhook_url = os.getenv("FEISHU_WEBHOOK_URL")
    if not webhook_url:
        print("Missing FEISHU_WEBHOOK_URL. Run with --dry-run to preview payload.", file=sys.stderr)
        return 2

    return send_payload(webhook_url, payload)


def load_brief(source: Path) -> dict:
    text = source.read_text(encoding="utf-8")
    if source.suffix.lower() == ".json":
        return json.loads(text)
    return parse_markdown(text)


def parse_markdown(markdown: str) -> dict:
    sections: dict[str, list[str]] = {}
    current = ""

    for line in markdown.splitlines():
        heading = re.match(r"^##\s+(.+?)\s*$", line)
        if heading:
            current = heading.group(1).strip()
            sections[current] = []
        elif current:
            sections[current].append(line.strip())

    meta = sections.get("基本信息", [])
    cover = sections.get("封面故事", [])
    observation = sections.get("Flora观察", [])
    action = sections.get("今日行动", [])

    return {
        "brand": "Flora Daily",
        "meta": {
            "date": value_after(meta, "日期"),
            "theme": value_after(meta, "主题"),
            "tagline": value_after(meta, "标语"),
        },
        "lead": " ".join(plain_lines(sections.get("今日一句话", []))),
        "cover": {
            "title": value_after(cover, "标题"),
            "summary": value_after(cover, "核心变化"),
            "bossQuestion": value_after(cover, "老板思考"),
        },
        "trends": parse_trends(sections.get("本周重点趋势", [])),
        "observation": {
            "question": value_after(observation, "今天最值得思考的问题"),
        },
        "radar": parse_radar(sections.get("机会雷达", [])),
        "action": {
            "title": value_after(action, "只做一件事"),
            "details": [
                line for line in plain_lines(action)
                if not line.startswith("只做一件事：") and not line.startswith("只做一件事:")
            ],
        },
        "footer": "信息创造价值 · 决策决定未来",
    }


def parse_trends(lines: list[str]) -> list[dict]:
    trends = []
    current = None

    for line in lines:
        heading = re.match(r"^###\s*([A-Z])\.\s*(.+?)\s*$", line, re.I)
        if heading:
            current = {"label": heading.group(1).upper(), "title": heading.group(2), "body": "", "advice": ""}
            trends.append(current)
            continue

        if not current:
            continue
        value = re.sub(r"^-\s*", "", line).strip()
        if value.startswith("发生了什么："):
            current["body"] = value.replace("发生了什么：", "", 1).strip()
        elif value.startswith("机会/风险："):
            current["body"] = join_sentence(current["body"], value.replace("机会/风险：", "", 1).strip())
        elif value.startswith("建议："):
            current["advice"] = value.replace("建议：", "", 1).strip()

    return trends


def parse_radar(lines: list[str]) -> list[dict]:
    radar = []
    for line in plain_lines(lines):
        level, _, rest = line.partition("：")
        title, _, summary = rest.partition("｜")
        if level and title:
            radar.append({"level": level, "title": title, "summary": summary})
    return radar


def build_card_payload(brief: dict, links: dict[str, str]) -> dict:
    title = brief.get("brand", "Flora Daily")
    meta = brief.get("meta", {})
    date = meta.get("date", "")
    theme = meta.get("theme", "")
    cover = brief.get("cover", {})
    action = brief.get("action", {})
    details = action.get("details") or []
    elements = [
        md_block(f"**{date}**\\n{theme}"),
        {"tag": "hr"},
        md_block(f"**今日一句话**\\n{brief.get('lead', '')}"),
        {"tag": "hr"},
        md_block(
            "\\n".join(
                filter(
                    None,
                    [
                        "**封面故事**",
                        f"**{cover.get('title', '')}**",
                        cover.get("summary", ""),
                        f"老板思考：{cover.get('bossQuestion', '')}" if cover.get("bossQuestion") else "",
                    ],
                )
            )
        ),
        {"tag": "hr"},
        field_block("本周重点趋势", trend_fields(brief.get("trends", []))),
        {"tag": "hr"},
        field_block("机会雷达", radar_fields(brief.get("radar", []))),
        {"tag": "hr"},
        md_block(
            "\\n".join(
                [
                    "**今日行动**",
                    action.get("title", ""),
                    *[f"- {item}" for item in details],
                ]
            )
        ),
    ]

    actions = link_buttons(links)
    if actions:
        elements.append({"tag": "action", "actions": actions})

    return {
        "msg_type": "interactive",
        "card": {
            "config": {"wide_screen_mode": True},
            "header": {
                "template": "green",
                "title": {"tag": "plain_text", "content": f"{title}｜每日老板决策简报"},
            },
            "elements": elements,
        },
    }


def build_text_payload(brief: dict, links: dict[str, str]) -> dict:
    lines = [
        brief.get("brand", "Flora Daily"),
        brief.get("meta", {}).get("date", ""),
        "",
        f"今日一句话：{brief.get('lead', '')}",
        f"封面故事：{brief.get('cover', {}).get('title', '')}",
        f"今日行动：{brief.get('action', {}).get('title', '')}",
    ]
    if links.get("page"):
        lines.append(f"网页版：{links['page']}")
    if links.get("pdf"):
        lines.append(f"PDF：{links['pdf']}")
    if links.get("image"):
        lines.append(f"截图：{links['image']}")
    return {"msg_type": "text", "content": {"text": "\\n".join(filter(None, lines))}}


def trend_block(trends: list[dict]) -> str:
    if not trends:
        return ""
    lines = ["**本周重点趋势**"]
    for trend in trends:
        lines.append(f"{trend.get('label', '')}. {trend.get('title', '')}：{trend.get('body', '')}")
    return "\\n".join(lines)


def md_block(content: str) -> dict:
    return {"tag": "div", "text": {"tag": "lark_md", "content": content}}


def field_block(title: str, fields: list[dict]) -> dict:
    if not fields:
        return md_block(f"**{title}**")
    return {"tag": "div", "text": {"tag": "lark_md", "content": f"**{title}**"}, "fields": fields}


def link_buttons(links: dict[str, str]) -> list[dict]:
    labels = {
        "page": "打开网页版",
        "pdf": "查看PDF",
        "image": "查看截图",
    }
    buttons = []
    for key, label in labels.items():
        url = links.get(key)
        if not url:
            continue
        buttons.append(
            {
                "tag": "button",
                "text": {"tag": "plain_text", "content": label},
                "type": "primary" if key == "page" else "default",
                "url": url,
            }
        )
    return buttons


def trend_fields(trends: list[dict]) -> list[dict]:
    fields = []
    for trend in trends:
        label = trend.get("label", "")
        heading = trend.get("title", "")
        body = trend.get("body", "")
        advice = trend.get("advice", "")
        content = f"**{label}. {heading}**\\n{body}"
        if advice:
            content += f"\\n建议：{advice}"
        fields.append({"is_short": True, "text": {"tag": "lark_md", "content": content}})
    return fields


def radar_fields(radar: list[dict]) -> list[dict]:
    fields = []
    for item in radar:
        content = f"**{item.get('level', '')}｜{item.get('title', '')}**\\n{item.get('summary', '')}"
        fields.append({"is_short": False, "text": {"tag": "lark_md", "content": content}})
    return fields


def radar_block(radar: list[dict]) -> str:
    if not radar:
        return ""
    lines = ["**机会雷达**"]
    for item in radar:
        lines.append(f"- {item.get('level', '')}｜{item.get('title', '')}：{item.get('summary', '')}")
    return "\\n".join(lines)


def apply_signature(payload: dict) -> None:
    secret = os.getenv("FEISHU_WEBHOOK_SECRET")
    if not secret:
        return

    timestamp = str(int(time.time()))
    string_to_sign = f"{timestamp}\n{secret}".encode("utf-8")
    sign = base64.b64encode(hmac.new(string_to_sign, b"", digestmod=hashlib.sha256).digest()).decode("utf-8")
    payload["timestamp"] = timestamp
    payload["sign"] = sign


def send_payload(webhook_url: str, payload: dict) -> int:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        print(error.read().decode("utf-8"), file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(str(error), file=sys.stderr)
        return 1

    print(body)
    result = json.loads(body)
    code = result.get("code", result.get("StatusCode", 0))
    return 0 if code == 0 else 1


def value_after(lines: list[str], label: str) -> str:
    pattern = re.compile(rf"^(?:-\s*)?{re.escape(label)}[：:]\s*(.*)$")
    for line in lines:
        match = pattern.match(line)
        if match:
            return match.group(1).strip()
    return ""


def plain_lines(lines: list[str]) -> list[str]:
    return [re.sub(r"^-\s*", "", line).strip() for line in lines if line.strip() and not line.startswith("#")]


def join_sentence(left: str, right: str) -> str:
    return f"{left} {right}".strip()


if __name__ == "__main__":
    raise SystemExit(main())
