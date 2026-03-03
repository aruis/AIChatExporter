(function attachContentRuntime(global) {
  const namespace = global.ExportAIChatContent || (global.ExportAIChatContent = {});

  function getProviderRegistry() {
    const registry = global.ExportAIChatProviderRegistry;
    if (!registry || typeof registry.findByUrl !== "function") {
      throw new Error("Provider 注册表未就绪，请刷新页面后重试");
    }
    return registry;
  }

  function getActiveProvider() {
    const registry = getProviderRegistry();
    return registry.findByUrl(global.location.href);
  }

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

  function detectTitle(provider) {
    const selectors = provider?.profile?.titleSelectors || ["main h1", "h1"];
    let titleNode = null;
    for (const selector of selectors) {
      titleNode = document.querySelector(selector);
      if (titleNode) {
        break;
      }
    }
    const text = cleanText(titleNode?.textContent || document.title || "chat");
    return sanitizeFilenamePart(text) || "chat";
  }

  namespace.runtime = {
    getProviderRegistry,
    getActiveProvider,
    cleanText,
    sanitizeFilenamePart,
    detectTitle
  };
})(globalThis);
