(function () {
  const DEFAULT_BRIEF = {
    brand: "Flora Daily",
    meta: {
      date: "2026年6月24日　星期三",
      theme: "AI × 跨境电商 × 老板决策简报",
      tagline: "每天5分钟 · 决策更从容"
    },
    lead: "美国和欧洲同时开始收紧跨境小包政策，而 Amazon 正在加速 AI 购物入口建设。未来两年的核心竞争力，可能不再只是流量获取，而是：产品力 + 合规能力 + AI运营能力。",
    cover: {
      title: "Amazon正在重构流量分配规则",
      summary: "从关键词搜索到 AI 购物助手，商品被理解、被推荐、被比较的逻辑正在变化。",
      flowPast: "消费者 → 搜索关键词 → 商品",
      flowFuture: "消费者 → AI购物助手 → 商品",
      signals: ["SEO权重下降", "商品语义表达能力上升", "品牌认知权重提升"],
      bossQuestion: "未来是否应该增加产品教育内容、视频内容、品牌资产建设，而不是只关注关键词排名？"
    },
    trends: [
      {
        label: "A",
        title: "AI Agent开始进入亚马逊运营",
        body: "越来越多工具开始支持自动选词、自动广告优化、自动差评分析、自动补货预测。未来6个月，运营岗位可能会从执行者，转向监督AI的人。",
        advice: "找一个小团队先试验，不要等行业成熟。"
      },
      {
        label: "B",
        title: "美国关税政策继续收紧",
        body: "双清包税模式风险继续上升。未来清关能力、HTS编码、Bond合规、产品认证，都会成为利润和门槛的一部分。",
        advice: "把清关模式和税务测算纳入供应链核心能力。"
      }
    ],
    observation: {
      question: "如果 Amazon 搜索有一天 80% 由 AI 完成，你们公司还有哪些能力是竞争对手复制不了的？",
      abilities: ["产品开发", "供应链", "品牌", "内容", "数据", "AI能力"]
    },
    radar: [
      { tone: "green", level: "高关注", title: "AI运营Agent", summary: "已经开始影响运营效率。" },
      { tone: "yellow", level: "观察", title: "英国低价包裹政策调整", summary: "欧洲可能进一步跟进。" },
      { tone: "red", level: "风险", title: "依赖低毛利小包产品", summary: "关税和物流成本持续上升。" }
    ],
    action: {
      title: "只做一件事：拉出公司前100个SKU利润表。",
      details: ["重新计算：广告费、FBA费、关税、退货率。", "看看哪些产品实际上已经不赚钱。"]
    },
    sources: [
      {
        title: "Announcements",
        publisher: "Sell on Amazon",
        url: "https://sell.amazon.com/blog/announcements",
        publishedAt: "",
        usedFor: "示例来源"
      }
    ],
    footer: "信息创造价值 · 决策决定未来"
  };

  const page = document.querySelector("#brief-page");
  const sourcePicker = document.querySelector("#source-picker");
  const reloadButton = document.querySelector("#reload-brief");
  const printButton = document.querySelector("#print-brief");

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const requestedSource = new URLSearchParams(window.location.search).get("source");
    const defaultSource = page.dataset.defaultSource;
    const source = requestedSource || defaultSource;

    if (sourcePicker) sourcePicker.value = source;
    loadBrief(source);

    sourcePicker?.addEventListener("change", () => loadBrief(sourcePicker.value));
    reloadButton?.addEventListener("click", () => loadBrief(sourcePicker?.value || defaultSource));
    printButton?.addEventListener("click", () => window.print());
  }

  async function loadBrief(source) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(`Cannot load ${source}`);

      const text = await response.text();
      const brief = source.toLowerCase().endsWith(".json")
        ? normalizeBrief(JSON.parse(text))
        : normalizeBrief(parseMarkdownBrief(text));

      renderBrief(brief);
    } catch (error) {
      console.warn("Using built-in Flora Daily fallback.", error);
      renderBrief(DEFAULT_BRIEF);
    }
  }

  function normalizeBrief(input) {
    const source = input || {};
    return {
      ...DEFAULT_BRIEF,
      ...source,
      meta: { ...DEFAULT_BRIEF.meta, ...(source.meta || {}) },
      cover: { ...DEFAULT_BRIEF.cover, ...(source.cover || {}) },
      trends: source.trends?.length ? source.trends : DEFAULT_BRIEF.trends,
      observation: { ...DEFAULT_BRIEF.observation, ...(source.observation || {}) },
      radar: source.radar?.length ? source.radar : DEFAULT_BRIEF.radar,
      action: { ...DEFAULT_BRIEF.action, ...(source.action || {}) },
      sources: source.sources?.length ? source.sources : DEFAULT_BRIEF.sources
    };
  }

  function parseMarkdownBrief(markdown) {
    const lines = markdown.split(/\r?\n/);
    const sections = collectSections(lines);
    const metaLines = sections["基本信息"] || [];
    const coverLines = sections["封面故事"] || [];
    const observationLines = sections["Flora观察"] || [];
    const radarLines = sections["机会雷达"] || [];
    const actionLines = sections["今日行动"] || [];

    const coverCore = valueAfter(coverLines, "核心变化");
    const coverWhy = valueAfter(coverLines, "为什么重要");
    const coverImpact = valueAfter(coverLines, "对公司影响");

    return {
      meta: {
        date: valueAfter(metaLines, "日期"),
        theme: valueAfter(metaLines, "主题"),
        tagline: valueAfter(metaLines, "标语")
      },
      lead: plainText(sections["今日一句话"]).join(""),
      cover: {
        title: valueAfter(coverLines, "标题"),
        summary: coverCore,
        signals: [coverCore, coverWhy, coverImpact].filter(Boolean),
        bossQuestion: valueAfter(coverLines, "老板思考")
      },
      trends: parseTrends(sections["本周重点趋势"] || []),
      observation: {
        question: valueAfter(observationLines, "今天最值得思考的问题"),
        abilities: splitAbilities(valueAfter(observationLines, "可选能力"))
      },
      radar: parseRadar(radarLines),
      action: parseAction(actionLines),
      sources: []
    };
  }

  function collectSections(lines) {
    const sections = {};
    let current = "";

    lines.forEach((line) => {
      const match = line.match(/^##\s+(.+?)\s*$/);
      if (match) {
        current = match[1].trim();
        sections[current] = [];
        return;
      }

      if (current) sections[current].push(line);
    });

    return sections;
  }

  function parseTrends(lines) {
    const trends = [];
    let current = null;

    lines.forEach((line) => {
      const heading = line.match(/^###\s*([A-Z])\.\s*(.+?)\s*$/i);
      if (heading) {
        current = { label: heading[1].toUpperCase(), title: heading[2], body: "", advice: "" };
        trends.push(current);
        return;
      }

      if (!current) return;
      const value = line.replace(/^-\s*/, "").trim();
      if (!value) return;

      if (value.startsWith("建议：")) current.advice = value.replace("建议：", "").trim();
      else if (value.startsWith("发生了什么：")) current.body = value.replace("发生了什么：", "").trim();
      else if (value.startsWith("机会/风险：")) current.body = joinSentences(current.body, value.replace("机会/风险：", "").trim());
      else current.body = joinSentences(current.body, value);
    });

    return trends;
  }

  function parseRadar(lines) {
    const tones = { 高关注: "green", 观察: "yellow", 风险: "red" };

    return lines
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter(Boolean)
      .map((line) => {
        const [levelPart, rest = ""] = line.split(/：(.+)/);
        const [title, summary = ""] = rest.split(/[｜|]/);
        return {
          tone: tones[levelPart] || "green",
          level: levelPart,
          title: title.trim(),
          summary: summary.trim()
        };
      });
  }

  function parseAction(lines) {
    const title = valueAfter(lines, "只做一件事");
    const details = plainText(lines)
      .filter((line) => !line.startsWith("只做一件事：") && !line.startsWith("只做一件事:"));

    return { title, details };
  }

  function valueAfter(lines, label) {
    const pattern = new RegExp(`^(?:-\\s*)?${escapeRegExp(label)}[：:]\\s*(.*)$`);
    const found = lines.map((line) => line.trim()).find((line) => pattern.test(line));
    return found ? found.replace(pattern, "$1").trim() : "";
  }

  function plainText(lines = []) {
    return lines
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"));
  }

  function splitAbilities(value) {
    return value ? value.split(/[、/｜|]/).map((item) => item.trim()).filter(Boolean) : [];
  }

  function joinSentences(left, right) {
    if (!left) return right;
    if (!right) return left;
    return `${left} ${right}`;
  }

  function renderBrief(brief) {
    setText("brand", brief.brand);
    setText("date", brief.meta.date);
    setText("theme", brief.meta.theme);
    setText("tagline", brief.meta.tagline);
    setText("lead", brief.lead);
    setText("cover.title", brief.cover.title);
    setText("cover.summary", brief.cover.summary);
    setText("cover.flowPast", brief.cover.flowPast);
    setText("cover.flowFuture", brief.cover.flowFuture);
    setText("cover.bossQuestion", brief.cover.bossQuestion);
    setText("observation.question", brief.observation.question);
    setText("action.title", brief.action.title);
    setText("footer", brief.footer);

    renderList("cover.signals", brief.cover.signals, (item) => el("li", item));
    renderList("observation.abilities", brief.observation.abilities, (item) => el("span", `□ ${item}`));
    renderList("trends", brief.trends, renderTrend);
    renderList("radar", brief.radar, renderRadar);
    renderList("action.details", brief.action.details, (item) => el("p", item));
    renderList("sources", brief.sources, renderSource);
  }

  function renderTrend(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "trend-item";
    wrapper.append(el("div", item.label, "badge"));
    wrapper.append(el("h3", item.title));
    wrapper.append(el("p", item.body));

    const advice = el("p", item.advice, "advice");
    advice.prepend(el("span", "建议："));
    wrapper.append(advice);
    return wrapper;
  }

  function renderRadar(item) {
    const wrapper = document.createElement("div");
    wrapper.className = `radar-item ${item.tone || "green"}`;
    wrapper.append(el("b", `${item.level}｜${item.title}`));
    wrapper.append(el("p", item.summary));
    return wrapper;
  }

  function renderSource(item) {
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.publisher || item.title || item.url;
    if (item.title) link.title = `${item.title}${item.publishedAt ? `｜${item.publishedAt}` : ""}`;
    return link;
  }

  function renderList(name, items, createItem) {
    const target = document.querySelector(`[data-list="${name}"]`);
    if (!target || !items?.length) return;
    target.replaceChildren(...items.map(createItem));
  }

  function setText(name, value) {
    const target = document.querySelector(`[data-field="${name}"]`);
    if (target && value) target.textContent = value;
  }

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text || "";
    return node;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
})();
