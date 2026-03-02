const ext = globalThis.browser ?? globalThis.chrome;
const EXPORT_BUILD_TAG = "dbg-20260301-c3";

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeFilenamePart(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 48);
}

function detectTitle() {
  const h1 = document.querySelector("main h1, h1");
  const text = cleanText(h1?.textContent || document.title || "chat");
  return sanitizeFilenamePart(text) || "chat";
}

function makeExportFilename(extName) {
  const base = detectTitle();
  return `${base}-${EXPORT_BUILD_TAG}.${extName}`;
}

function getMessageRoots() {
  const turnNodes = [...document.querySelectorAll("main article[data-turn]")].filter((node) => {
    const turn = node.getAttribute("data-turn");
    return turn === "user" || turn === "assistant" || turn === "tool";
  });
  if (turnNodes.length >= 2) {
    return turnNodes;
  }

  const strictNodes = [...document.querySelectorAll("main [data-message-author-role]")];
  if (strictNodes.length >= 2) {
    return strictNodes;
  }

  const fallbackNodes = [...document.querySelectorAll("main article")];
  if (fallbackNodes.length >= 2) {
    return fallbackNodes;
  }

  return [];
}

function detectRole(node) {
  const turnRole = node.getAttribute?.("data-turn");
  if (turnRole === "user" || turnRole === "assistant" || turnRole === "tool") {
    return turnRole;
  }

  const withRole = node.closest("[data-message-author-role]") || node;
  const explicitRole = withRole.getAttribute?.("data-message-author-role");
  if (explicitRole === "user" || explicitRole === "assistant" || explicitRole === "tool") {
    return explicitRole;
  }

  const text = (node.textContent || "").slice(0, 240).toLowerCase();
  if (text.includes("you said") || text.includes("你说") || text.includes("你:")) {
    return "user";
  }

  return "assistant";
}

function detectCodeLanguage(preNode) {
  const codeNode = preNode.querySelector("code");
  const bucket = [preNode, codeNode].filter(Boolean);
  for (const node of bucket) {
    const className = node.className || "";
    const matched = className.match(/language-([a-zA-Z0-9_+-]+)/);
    if (matched?.[1]) {
      return matched[1];
    }
  }
  return "";
}

function toFencedCode(preNode) {
  const raw = preNode.innerText || preNode.textContent || "";
  const code = raw.trimEnd();
  if (!code) {
    return "";
  }
  const lang = detectCodeLanguage(preNode);
  return `\n\n\`\`\`${lang}\n${code}\n\`\`\``;
}

function getPrimaryContentNode(root) {
  const candidates = [
    "[data-message-author-role] .text-message .whitespace-pre-wrap",
    ".text-message .whitespace-pre-wrap",
    "[data-message-author-role] .markdown",
    "[data-message-author-role] [class*='prose']",
    ".markdown",
    "[class*='prose']",
    "[data-message-author-role] .text-message",
    ".text-message"
  ];

  for (const selector of candidates) {
    const found = root.querySelector(selector);
    if (found) {
      return found;
    }
  }

  return root;
}

function normalizeInlineText(value) {
  return String(value || "").replace(/\u00a0/g, " ");
}

function escapeMarkdownText(value) {
  return String(value || "").replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function toInlineMarkdown(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeInlineText(node.textContent);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") {
    return "\n";
  }

  const children = [...el.childNodes].map((child) => toInlineMarkdown(child)).join("");
  const text = children.trim();
  if (!text) {
    return "";
  }

  if (tag === "strong" || tag === "b") {
    return `**${text}**`;
  }
  if (tag === "em" || tag === "i") {
    return `*${text}*`;
  }
  if (tag === "del" || tag === "s") {
    return `~~${text}~~`;
  }
  if (tag === "code") {
    if (text.includes("`")) {
      return `\`\`${text}\`\``;
    }
    return `\`${text}\``;
  }
  if (tag === "a") {
    const href = el.getAttribute("href") || "";
    if (!href) {
      return text;
    }
    return `[${text}](${href})`;
  }
  if (tag === "img") {
    const alt = el.getAttribute("alt") || "";
    const src = el.getAttribute("src") || "";
    if (!src) {
      return alt ? escapeMarkdownText(alt) : "";
    }
    return `![${escapeMarkdownText(alt)}](${src})`;
  }

  return children;
}

function mergeInlineText(node) {
  return toInlineMarkdown(node)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function detectTaskState(li) {
  const checkbox = li.querySelector(":scope > input[type='checkbox'], :scope > label input[type='checkbox']");
  if (!checkbox) {
    return null;
  }
  return checkbox.checked ? "x" : " ";
}

function serializeList(listEl, indentLevel = 0, ordered = false) {
  const liNodes = [...listEl.children].filter((item) => item.tagName?.toLowerCase() === "li");
  const lines = [];
  const start = ordered ? Math.max(1, Number.parseInt(listEl.getAttribute("start") || "1", 10) || 1) : 1;

  liNodes.forEach((li, index) => {
    const prefixBase = "  ".repeat(indentLevel);
    const marker = ordered ? `${start + index}.` : "-";
    const nestedLists = [];
    const bodyParts = [];
    const taskState = detectTaskState(li);

    [...li.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === "input" && child.getAttribute("type") === "checkbox") {
          return;
        }
        if (tag === "label") {
          const labelClone = child.cloneNode(true);
          labelClone.querySelectorAll("input[type='checkbox']").forEach((el) => el.remove());
          const labelInline = mergeInlineText(labelClone);
          if (labelInline) {
            bodyParts.push(labelInline);
          }
          return;
        }
        if (tag === "ul" || tag === "ol") {
          nestedLists.push(serializeList(child, indentLevel + 1, tag === "ol"));
          return;
        }
      }
      const inline = mergeInlineText(child);
      if (inline) {
        bodyParts.push(inline);
      }
    });

    const body = bodyParts.join(" ").trim();
    const taskPrefix = taskState !== null ? `[${taskState}] ` : "";
    lines.push(`${prefixBase}${marker} ${taskPrefix}${body}`.trimEnd());
    nestedLists.filter(Boolean).forEach((block) => lines.push(block));
  });

  return lines.join("\n");
}

function serializeTable(tableEl) {
  const rowEls = [...tableEl.querySelectorAll("tr")];
  if (!rowEls.length) {
    return "";
  }

  const rows = rowEls.map((tr) =>
    [...tr.querySelectorAll("th,td")].map((cell) => mergeInlineText(cell).replace(/\n/g, "<br>").trim())
  ).filter((row) => row.length > 0);

  if (!rows.length) {
    return "";
  }

  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => {
    const next = [...row];
    while (next.length < width) {
      next.push("");
    }
    return next;
  });

  const header = normalizedRows[0];
  const body = normalizedRows.slice(1);

  const headerLine = `| ${header.join(" | ")} |`;
  const dividerLine = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  const bodyLines = body.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, dividerLine, ...bodyLines].join("\n");
}

function toBlockMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return mergeInlineText(node);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node;
  const tag = el.tagName.toLowerCase();

  if (tag === "pre") {
    return toFencedCode(el).trim();
  }
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    return `${"#".repeat(level)} ${mergeInlineText(el)}`.trim();
  }
  if (tag === "ul" || tag === "ol") {
    return serializeList(el, 0, tag === "ol");
  }
  if (tag === "blockquote") {
    const content = serializeChildrenMarkdown(el);
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (tag === "table") {
    return serializeTable(el);
  }
  if (tag === "hr") {
    return "---";
  }
  if (tag === "p") {
    return mergeInlineText(el);
  }

  const hasBlockChildren = [...el.children].some((child) => {
    const childTag = child.tagName.toLowerCase();
    return ["p", "pre", "ul", "ol", "blockquote", "table", "hr"].includes(childTag) || /^h[1-6]$/.test(childTag);
  });

  if (hasBlockChildren) {
    return serializeChildrenMarkdown(el);
  }

  return mergeInlineText(el);
}

function serializeChildrenMarkdown(root) {
  const blocks = [];
  [...root.childNodes].forEach((child) => {
    const block = toBlockMarkdown(child).trim();
    if (block) {
      blocks.push(block);
    }
  });
  return blocks.join("\n\n");
}

function nodeToMarkdown(root) {
  const contentNode = getPrimaryContentNode(root);
  const clone = contentNode.cloneNode(true);
  clone.querySelectorAll("button, nav, svg, script, style").forEach((el) => el.remove());

  if (clone.matches?.(".whitespace-pre-wrap") && !clone.querySelector("p,ul,ol,table,blockquote,pre")) {
    return cleanText(clone.innerText || clone.textContent || "");
  }

  const markdown = serializeChildrenMarkdown(clone) || mergeInlineText(clone);
  return cleanText(markdown);
}

function extractConversation() {
  const roots = getMessageRoots();
  if (!roots.length) {
    throw new Error("未识别到对话内容，请在 ChatGPT 会话页面使用");
  }

  const messages = [];

  for (const root of roots) {
    const text = nodeToMarkdown(root);
    if (!text) {
      continue;
    }

    messages.push({
      role: detectRole(root),
      text
    });
  }

  if (!messages.length) {
    throw new Error("对话为空，无法导出");
  }

  return {
    title: detectTitle(),
    messages
  };
}

function buildMarkdown(messages) {
  const lines = ["# ChatGPT Conversation", ""];

  for (const item of messages) {
    const roleTitle = item.role === "user" ? "User" : item.role === "assistant" ? "Assistant" : "Tool";
    lines.push(`## ${roleTitle}`);
    lines.push("");
    lines.push(item.text);
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportMarkdown() {
  const { messages } = extractConversation();
  const markdown = buildMarkdown(messages);

  const blob = new Blob([`\uFEFF${markdown}`], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, makeExportFilename("md"));

  return { ok: true, message: "Markdown 导出成功" };
}

function collectConversation() {
  const result = extractConversation();
  return {
    ok: true,
    title: result.title,
    messages: result.messages
  };
}

ext.runtime.onMessage.addListener((request) => {
  const action = request?.action;

  if (action === "export_markdown") {
    return exportMarkdown().catch((error) => ({ ok: false, error: error?.message || String(error) }));
  }

  if (action === "collect_conversation") {
    return Promise.resolve().then(() => collectConversation())
      .catch((error) => ({ ok: false, error: error?.message || String(error) }));
  }

  if (action === "export_png" || action === "export_pdf") {
    return Promise.resolve({ ok: false, error: "请使用导出工作台进行 PNG/PDF 导出" });
  }

  return undefined;
});
