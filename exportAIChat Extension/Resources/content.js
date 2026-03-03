const ext = globalThis.browser ?? globalThis.chrome;
const EXPORT_BUILD_TAG = "dbg-20260301-c3";

function getContentNamespace() {
  const namespace = globalThis.ExportAIChatContent;
  if (!namespace?.runtime || !namespace?.extractors) {
    throw new Error("内容提取模块未就绪，请刷新页面后重试");
  }
  return namespace;
}

function makeExportFilename(extName, provider) {
  const { runtime } = getContentNamespace();
  const base = runtime.detectTitle(provider);
  return `${base}-${EXPORT_BUILD_TAG}.${extName}`;
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

function resolveActiveProvider() {
  const { runtime } = getContentNamespace();
  const provider = runtime.getActiveProvider();
  if (!provider) {
    throw new Error("当前站点尚未接入导出能力");
  }
  return provider;
}

async function exportMarkdown() {
  const provider = resolveActiveProvider();
  const { extractors } = getContentNamespace();
  const { messages } = extractors.extractConversation(provider);
  const markdown = extractors.buildMarkdown(messages, provider);

  const blob = new Blob([`\uFEFF${markdown}`], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, makeExportFilename("md", provider));
  return { ok: true, message: "Markdown 导出成功" };
}

function collectConversation() {
  const provider = resolveActiveProvider();
  const { extractors } = getContentNamespace();
  const result = extractors.extractConversation(provider);
  return {
    ok: true,
    title: result.title,
    messages: result.messages,
    providerId: result.providerId,
    providerName: result.providerName
  };
}

function getProviderInfo() {
  const { runtime } = getContentNamespace();
  const provider = runtime.getActiveProvider();
  return {
    ok: true,
    supported: Boolean(provider),
    providerId: provider?.id || null,
    providerName: provider?.name || null
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

  if (action === "get_provider_info") {
    return Promise.resolve().then(() => getProviderInfo())
      .catch((error) => ({ ok: false, error: error?.message || String(error) }));
  }

  if (action === "export_png" || action === "export_pdf") {
    return Promise.resolve({ ok: false, error: "请使用导出工作台进行 PNG/PDF 导出" });
  }

  return undefined;
});
