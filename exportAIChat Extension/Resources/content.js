const ext = globalThis.browser ?? globalThis.chrome;
const EXPORT_BUILD_TAG = "dbg-20260301-b";

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

function toFencedCode(preNode) {
  const raw = preNode.innerText || "";
  const code = raw.trimEnd();
  if (!code) {
    return "";
  }

  return `\n\n\`\`\`\n${code}\n\`\`\``;
}

function getPrimaryContentNode(root) {
  const candidates = [
    "[data-message-author-role] .markdown",
    "[data-message-author-role] [class*='prose']",
    ".markdown",
    "[class*='prose']"
  ];

  for (const selector of candidates) {
    const found = root.querySelector(selector);
    if (found) {
      return found;
    }
  }

  return root;
}

function nodeToMarkdown(root) {
  const contentNode = getPrimaryContentNode(root);
  const clone = contentNode.cloneNode(true);

  const codeBlocks = [...clone.querySelectorAll("pre")].map(toFencedCode).filter(Boolean);
  clone.querySelectorAll("pre").forEach((el) => el.remove());

  clone.querySelectorAll("button, nav, svg").forEach((el) => el.remove());

  const text = cleanText(clone.innerText || "");
  const merged = [text, ...codeBlocks].filter(Boolean).join("\n\n");
  return cleanText(merged);
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
