# Flora Daily Codex Project

这是一个 Codex 可接手的前端项目，用来把每日「AI × 跨境电商 × 老板决策简报」做成杂志式一页版式。

## 文件结构

```text
flora-daily-codex-project/
├── index.html                         # 主页面
├── styles.css                         # 杂志版式样式
├── brief-loader.js                    # Markdown/JSON 内容加载器
├── scripts/send_feishu.py             # 飞书机器人推送脚本
├── .github/workflows/flora-daily-feishu.yml # GitHub Actions 每日推送
├── package.json                       # 可选：用 Vite 本地预览
├── AGENTS.md                          # 给 Codex 的项目说明
├── .codex/config.toml                 # Codex 项目级配置占位
├── content/daily-brief-template.md    # 每日简报内容模板
├── content/daily-brief.json           # JSON 内容示例
└── assets/flora-daily-reference.png   # 当前设计参考图
```

## 本地打开

最简单方式：直接双击 `index.html`。如果浏览器限制本地文件读取，页面会显示内置示例内容；需要从 `content/` 动态读取 Markdown 或 JSON 时，建议用本地服务预览。

也可以用 Vite 预览：

```bash
npm install
npm run dev
```

打开后默认读取：

```text
content/daily-brief-template.md
```

也可以切换到 JSON 示例：

```text
content/daily-brief.json
```

或在 URL 中指定内容源：

```text
/?source=./content/daily-brief.json
```

## 打印 PDF

页面按 A4 竖版优化。点击页面上方「打印/PDF」，或使用浏览器打印功能，纸张选择 A4，边距选择无或默认，背景图形保持开启。

## 飞书推送

推荐先在飞书群里添加「自定义机器人」，复制 webhook 地址，然后在本机环境变量里配置：

```bash
export FEISHU_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/..."
```

如果机器人开启了签名校验，再配置：

```bash
export FEISHU_WEBHOOK_SECRET="..."
```

预览将要发送的卡片：

```bash
python3 scripts/send_feishu.py --dry-run
```

发送默认 JSON 内容：

```bash
python3 scripts/send_feishu.py
```

发送 Markdown 内容：

```bash
python3 scripts/send_feishu.py --source content/daily-brief-template.md
```

如果已经有公开可访问的网页、PDF 或截图地址，可以一起放到飞书卡片底部：

```bash
python3 scripts/send_feishu.py \
  --page-url "https://example.com/flora-daily.html" \
  --pdf-url "https://example.com/flora-daily.pdf" \
  --image-url "https://example.com/flora-daily.png"
```

也可以用环境变量配置：

```bash
export FLORA_DAILY_PAGE_URL="https://example.com/flora-daily.html"
export FLORA_DAILY_PDF_URL="https://example.com/flora-daily.pdf"
export FLORA_DAILY_IMAGE_URL="https://example.com/flora-daily.png"
```

## GitHub Actions 自动推送

仓库推到 GitHub 后，GitHub Actions 会按北京时间每天 08:30 推送飞书。对应 cron 使用 UTC 时间：

```text
30 0 * * *
```

在 GitHub 仓库里进入 `Settings` → `Secrets and variables` → `Actions`，添加：

```text
FEISHU_WEBHOOK_URL
FEISHU_WEBHOOK_SECRET
```

工作流会先把杂志版网页发布到 GitHub Pages，并生成：

```text
index.html
flora-daily.pdf
flora-daily.png
```

然后飞书卡片底部会自动带上：

```text
打开网页版
查看PDF
查看截图
```

第一次配置完后，需要在仓库 `Settings` → `Pages` 中确认 Source 使用 `GitHub Actions`。然后进入 `Actions` → `Flora Daily Feishu Push` → `Run workflow` 手动测试一次。

## 在 Codex 中继续开发

把整个文件夹作为一个项目目录打开，然后让 Codex 按以下方向继续做：

1. 把 `index.html` 改成可替换日报内容的数据模板。
2. 增加“一键生成今日版”的 JSON 或 Markdown 输入。
3. 增加打印为 PDF 的样式优化。
4. 增加移动端预览版本。
5. 后续可以接入每日简报内容，让它自动渲染成网页或 PDF。

## 推荐给 Codex 的第一条任务

```text
请阅读 AGENTS.md、index.html、styles.css 和 content/daily-brief-template.md。
把这个项目优化成一个可复用的每日简报模板：内容从 content/daily-brief-template.md 或 JSON 读取，页面保持现在的杂志风格，并优化打印成 A4 PDF 的效果。
```
