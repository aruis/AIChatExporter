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

function getMarkdownSerializer() {
  const serializer = globalThis.ExportAIChatMarkdownSerializer;
  if (!serializer || typeof serializer.nodeToMarkdown !== "function") {
    throw new Error("Markdown 序列化器未就绪，请刷新页面后重试");
  }
  return serializer;
}

function extractConversation() {
  const serializer = getMarkdownSerializer();
  const roots = getMessageRoots();
  if (!roots.length) {
    throw new Error("未识别到对话内容，请在 ChatGPT 会话页面使用");
  }

  const messages = [];

  for (const root of roots) {
    const text = serializer.nodeToMarkdown(root);
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
