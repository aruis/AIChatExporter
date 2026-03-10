(function attachProviderRegistry(global) {
  const DEFAULT_PROVIDER_PROFILE = {
    titleStrategy: "selectors-first",
    titleSelectors: ["main h1", "h1"],
    messageRootSelectors: ["main article"],
    userMessageSelectors: [],
    assistantMessageSelectors: [],
    minimumMessageCount: 2,
    contentRootSelectors: [
      ".text-message .whitespace-pre-wrap",
      ".markdown",
      "[class*='prose']",
      ".text-message"
    ],
    roleAttributes: ["data-turn", "data-message-author-role"],
    roleSelectors: [],
    userRoleHints: ["you said", "你说", "你:"],
    markdownHeading: "AI Conversation",
    disableDefaultArticleFallback: false
  };

  const definitions = global.ExportAIChatProviderDefinitions || (global.ExportAIChatProviderDefinitions = []);

  function registerProvider(provider) {
    const id = String(provider?.id || "").trim();
    if (!id) {
      throw new Error("Provider id is required");
    }

    const index = definitions.findIndex((item) => item?.id === id);
    if (index >= 0) {
      definitions[index] = provider;
      return;
    }
    definitions.push(provider);
  }

  function matchesPattern(hostname, pattern) {
    if (!hostname || !pattern) {
      return false;
    }
    if (hostname === pattern) {
      return true;
    }
    return hostname.endsWith(`.${pattern}`);
  }

  function normalizeProvider(provider) {
    const rawProfile = provider.profile || {};
    const titleStrategy = rawProfile.titleStrategy
      || (rawProfile.preferDocumentTitle ? "document-first" : DEFAULT_PROVIDER_PROFILE.titleStrategy);

    return {
      ...provider,
      profile: {
        ...DEFAULT_PROVIDER_PROFILE,
        ...rawProfile,
        titleStrategy,
        contentRootSelectors: rawProfile.contentRootSelectors || rawProfile.contentSelectors || DEFAULT_PROVIDER_PROFILE.contentRootSelectors
      }
    };
  }

  function safeParseHostname(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function findByUrl(url) {
    const hostname = safeParseHostname(url);
    if (!hostname) {
      return null;
    }

    for (const provider of definitions) {
      const patterns = Array.isArray(provider.urlPatterns) ? provider.urlPatterns : [];
      if (patterns.some((pattern) => matchesPattern(hostname, pattern))) {
        return normalizeProvider(provider);
      }
    }
    return null;
  }

  function getById(id) {
    const matched = definitions.find((provider) => provider.id === id);
    return matched ? normalizeProvider(matched) : null;
  }

  function list() {
    return definitions.map((provider) => normalizeProvider(provider));
  }

  global.ExportAIChatProviderRegistry = {
    registerProvider,
    findByUrl,
    getById,
    list
  };
})(globalThis);
