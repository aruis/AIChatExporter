import { createMarkdownRenderer, ensureMarkdownRuntime } from "./markdown_renderer.js";

const FIXTURES = [
  {
    id: "heading-list",
    title: "标题与列表",
    markdown: `# 标题一级
## 标题二级

- 列表项 A
- 列表项 B
  - 嵌套项 B.1

3. 从 3 开始
4. 连续编号`
  },
  {
    id: "task-list",
    title: "任务列表",
    markdown: `- [ ] 未完成任务
- [x] 已完成任务`
  },
  {
    id: "quote-link-inline",
    title: "引用、链接、行内样式",
    markdown: `> 这是引用段落
> 第二行

访问 [ChatGPT](https://chatgpt.com)，并使用 \`inline code\`、**加粗**、*斜体*、~~删除线~~。`
  },
  {
    id: "code-table",
    title: "代码块与表格",
    markdown: `\`\`\`js
function add(a, b) {
  return a + b;
}
\`\`\`

| 列名 | 值 |
| --- | --- |
| alpha | 1 |
| beta | 2 |`
  }
];

const ASSERTIONS = [
  {
    id: "task-checkbox",
    label: "任务列表渲染出 checkbox",
    pass: (root) => root.querySelectorAll("input[type='checkbox']").length >= 2
  },
  {
    id: "table",
    label: "表格渲染为 table",
    pass: (root) => root.querySelectorAll("table").length >= 1
  },
  {
    id: "code-block",
    label: "代码块渲染为 pre > code",
    pass: (root) => root.querySelectorAll("pre code").length >= 1
  },
  {
    id: "link-safety",
    label: "链接包含安全属性 rel+target",
    pass: (root) => {
      const links = [...root.querySelectorAll(".rendered a[href]")];
      if (!links.length) return false;
      return links.every((link) =>
        link.getAttribute("target") === "_blank"
        && String(link.getAttribute("rel") || "").includes("noopener")
      );
    }
  }
];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFixtureCard(renderer, fixture) {
  const html = renderer(fixture.markdown);
  return `
    <article class="fixture" data-fixture-id="${fixture.id}">
      <h2>${escapeHtml(fixture.title)}</h2>
      <div class="fixture-grid">
        <section class="source">
          <pre>${escapeHtml(fixture.markdown)}</pre>
        </section>
        <section class="rendered" data-rendered-id="${fixture.id}">
          ${html}
        </section>
      </div>
    </article>
  `;
}

async function renderAll() {
  const fixturesEl = document.getElementById("fixtures");
  const assertionsEl = document.getElementById("assertions");

  try {
    await ensureMarkdownRuntime();
    const renderer = createMarkdownRenderer();
    fixturesEl.innerHTML = FIXTURES.map((fixture) => renderFixtureCard(renderer, fixture)).join("");

    const assertionItems = ASSERTIONS.map((check) => {
      const passed = check.pass(fixturesEl);
      return `<li class="${passed ? "ok" : "bad"}">${passed ? "PASS" : "FAIL"} · ${escapeHtml(check.label)}</li>`;
    });
    assertionsEl.innerHTML = assertionItems.join("");
  } catch (error) {
    fixturesEl.innerHTML = `<article class="fixture"><h2>渲染失败</h2><div class="source"><pre>${escapeHtml(error?.message || String(error))}</pre></div></article>`;
    assertionsEl.innerHTML = `<li class="bad">FAIL · 初始化失败</li>`;
  }
}

document.getElementById("rerender-btn")?.addEventListener("click", () => {
  void renderAll();
});

void renderAll();
