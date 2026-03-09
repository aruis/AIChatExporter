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

  function normalizeTitleCandidate(raw, provider) {
    let text = cleanText(raw || "");
    if (!text) {
      return "";
    }

    const providerName = cleanText(provider?.name || "");
    if (providerName) {
      const escaped = providerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text
        .replace(new RegExp(`\\s*[-|·:]\\s*${escaped}$`, "i"), "")
        .replace(new RegExp(`^${escaped}\\s*[-|·:]\\s*`, "i"), "");
    }

    return cleanText(text);
  }

  function isGenericTitle(text, provider) {
    const normalized = cleanText(text).toLowerCase();
    if (!normalized) {
      return true;
    }

    const providerName = cleanText(provider?.name || "").toLowerCase();
    const genericTitles = new Set([
      "chat",
      "new chat",
      "new conversation",
      "untitled",
      "untitled chat",
      "conversation",
      "ai conversation",
      providerName
    ].filter(Boolean));

    return genericTitles.has(normalized);
  }

  function detectTitle(provider) {
    const selectors = provider?.profile?.titleSelectors || ["main h1", "h1"];
    const candidates = [];
    const preferDocumentTitle = Boolean(provider?.profile?.preferDocumentTitle);

    const documentTitle = normalizeTitleCandidate(document.title || "", provider);
    if (documentTitle && preferDocumentTitle) {
      candidates.push(documentTitle);
    }

    for (const selector of selectors) {
      const titleNode = document.querySelector(selector);
      const text = normalizeTitleCandidate(titleNode?.textContent || "", provider);
      if (text) {
        candidates.push(text);
      }
    }

    if (documentTitle && !preferDocumentTitle) {
      candidates.push(documentTitle);
    }

    const bestCandidate = candidates.find((text) => !isGenericTitle(text, provider))
      || candidates[0]
      || "chat";

    return sanitizeFilenamePart(bestCandidate) || "chat";
  }

  namespace.runtime = {
    getProviderRegistry,
    getActiveProvider,
    cleanText,
    sanitizeFilenamePart,
    detectTitle
  };
})(globalThis);
