import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "content", "daily-brief.json");
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-5.4";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required to generate the daily brief.");
}

const today = new Date();
const dateText = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(today);
const accessedAt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
}).format(today);

const sourcePolicy = [
  "OpenAI News: https://openai.com/news/",
  "Anthropic News: https://www.anthropic.com/news",
  "Google AI Blog: https://blog.google/innovation-and-ai/technology/ai/",
  "Google DeepMind Blog: https://deepmind.google/blog/",
  "Amazon Seller Announcements: https://sell.amazon.com/blog/announcements",
  "Amazon Seller Forums - News and Announcements: https://sellercentral.amazon.com/seller-forums",
  "Shopify Changelog: https://changelog.shopify.com/",
  "Shopify Developer Changelog: https://shopify.dev/changelog",
  "CBP Trade News Snapshot: https://www.cbp.gov/trade/snapshot",
  "Federal Register: https://www.federalregister.gov/",
  "USTR Press Releases: https://ustr.gov/about-us/policy-offices/press-office/press-releases",
  "USITC Press Room: https://www.usitc.gov/offices/er/press_room",
  "EU Taxation and Customs Union: https://taxation-customs.ec.europa.eu/index_en",
  "UK Trade Tariff News: https://www.trade-tariff.service.gov.uk/news/collections/trade_news",
];

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["brand", "meta", "lead", "cover", "trends", "observation", "radar", "action", "sources", "footer"],
  properties: {
    brand: { type: "string" },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["date", "theme", "tagline"],
      properties: {
        date: { type: "string" },
        theme: { type: "string" },
        tagline: { type: "string" },
      },
    },
    lead: { type: "string" },
    cover: {
      type: "object",
      additionalProperties: false,
      required: ["title", "summary", "flowPast", "flowFuture", "signals", "bossQuestion"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        flowPast: { type: "string" },
        flowFuture: { type: "string" },
        signals: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" },
        },
        bossQuestion: { type: "string" },
      },
    },
    trends: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "title", "body", "advice"],
        properties: {
          label: { type: "string", enum: ["A", "B"] },
          title: { type: "string" },
          body: { type: "string" },
          advice: { type: "string" },
        },
      },
    },
    observation: {
      type: "object",
      additionalProperties: false,
      required: ["question", "abilities"],
      properties: {
        question: { type: "string" },
        abilities: {
          type: "array",
          minItems: 6,
          maxItems: 6,
          items: { type: "string" },
        },
      },
    },
    radar: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tone", "level", "title", "summary"],
        properties: {
          tone: { type: "string", enum: ["green", "yellow", "red"] },
          level: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
        },
      },
    },
    action: {
      type: "object",
      additionalProperties: false,
      required: ["title", "details"],
      properties: {
        title: { type: "string" },
        details: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: { type: "string" },
        },
      },
    },
    sources: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "publisher", "url", "publishedAt", "usedFor"],
        properties: {
          title: { type: "string" },
          publisher: { type: "string" },
          url: { type: "string" },
          publishedAt: { type: "string" },
          usedFor: { type: "string" },
        },
      },
    },
    footer: { type: "string" },
  },
};

const input = `
你是 Flora Daily 的主编。请为 ${dateText} 生成一份中文每日商业简报，面向跨境电商公司老板。

核心主题：AI 与科技趋势、跨境电商、Amazon/Shopify/TikTok Shop、关税/清关/合规、供应链、产品开发。

只优先使用这些来源；如使用其他来源，必须是官方/一手来源或权威媒体，并在 sources 里说明：
${sourcePolicy.map((source) => `- ${source}`).join("\n")}

要求：
- 使用 web search 查找最近 7 天内最值得老板关注的信息。
- 没有可靠来源链接的信息不要写入。
- 语气直白、克制、有判断，不要夸张。
- lead 不超过 90 个中文字符。
- trends 只写 2 条，分别是 A 和 B。
- radar 固定 3 条，tone 分别用 green、yellow、red。
- 每条建议必须落到老板能安排的动作。
- 所有正文用中文，必要行业词可保留英文。
- meta.date 必须使用：${dateText}
- meta.theme 固定为：AI × 跨境电商 × 老板决策简报
- meta.tagline 固定为：每天5分钟 · 决策更从容
- footer 固定为：信息创造价值 · 决策决定未来
- sources 的 publishedAt 如无法确认，用“访问于 ${accessedAt}”。
`;

const payload = {
  model,
  tools: [{ type: "web_search" }],
  input,
  text: {
    format: {
      type: "json_schema",
      name: "flora_daily_brief",
      strict: true,
      schema,
    },
  },
};

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const responseText = await response.text();
if (!response.ok) {
  throw new Error(`OpenAI API error ${response.status}: ${responseText}`);
}

const result = JSON.parse(responseText);
const outputText = extractOutputText(result);
const brief = JSON.parse(outputText);
validateBrief(brief);

await fs.writeFile(outputPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(repoRoot, outputPath)} with ${brief.sources.length} sources.`);

function extractOutputText(result) {
  if (result.output_text) return result.output_text;

  const chunks = [];
  for (const item of result.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }

  if (!chunks.length) {
    throw new Error("No text output returned by OpenAI API.");
  }
  return chunks.join("");
}

function validateBrief(brief) {
  const requiredPaths = [
    "meta.date",
    "lead",
    "cover.title",
    "cover.summary",
    "observation.question",
    "action.title",
  ];

  for (const requiredPath of requiredPaths) {
    const value = requiredPath.split(".").reduce((current, key) => current?.[key], brief);
    if (!value) throw new Error(`Generated brief is missing ${requiredPath}.`);
  }

  if (!Array.isArray(brief.trends) || brief.trends.length !== 2) {
    throw new Error("Generated brief must contain exactly 2 trends.");
  }
  if (!Array.isArray(brief.radar) || brief.radar.length !== 3) {
    throw new Error("Generated brief must contain exactly 3 radar items.");
  }
  if (!Array.isArray(brief.sources) || brief.sources.length < 3) {
    throw new Error("Generated brief must contain at least 3 sources.");
  }
}
