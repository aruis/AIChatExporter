(function attachProviderRegistry(global) {
  const DEFAULT_PROVIDER_PROFILE = {
    titleSelectors: ["main h1", "h1"],
    messageRootSelectors: ["main article"],
    minimumMessageCount: 2,
    contentSelectors: [
      ".text-message .whitespace-pre-wrap",
      ".markdown",
      "[class*='prose']",
      ".text-message"
    ],
    roleAttributes: ["data-turn", "data-message-author-role"],
    userRoleHints: ["you said", "你说", "你:"],
    markdownHeading: "AI Conversation"
  };

  const PROVIDERS = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      urlPatterns: ["chatgpt.com", "chat.openai.com"],
      profile: {
        titleSelectors: ["main h1", "h1"],
        messageRootSelectors: [
          "main article[data-turn]",
          "main [data-message-author-role]",
          "main article"
        ],
        minimumMessageCount: 2,
        contentSelectors: [
          "[data-message-author-role] .text-message .whitespace-pre-wrap",
          ".text-message .whitespace-pre-wrap",
          "[data-message-author-role] .markdown",
          "[data-message-author-role] [class*='prose']",
          ".markdown",
          "[class*='prose']",
          "[data-message-author-role] .text-message",
          ".text-message"
        ],
        roleAttributes: ["data-turn", "data-message-author-role"],
        userRoleHints: ["you said", "你说", "你:"],
        markdownHeading: "ChatGPT Conversation"
      }
    },
    {
      id: "claude",
      name: "Claude",
      urlPatterns: ["claude.ai"]
    },
    {
      id: "gemini",
      name: "Gemini",
      urlPatterns: ["gemini.google.com", "aistudio.google.com"]
    },
    {
      id: "perplexity",
      name: "Perplexity",
      urlPatterns: ["perplexity.ai", "www.perplexity.ai"]
    }
  ];

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
    return {
      ...provider,
      profile: {
        ...DEFAULT_PROVIDER_PROFILE,
        ...(provider.profile || {})
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

    for (const provider of PROVIDERS) {
      const patterns = Array.isArray(provider.urlPatterns) ? provider.urlPatterns : [];
      if (patterns.some((pattern) => matchesPattern(hostname, pattern))) {
        return normalizeProvider(provider);
      }
    }
    return null;
  }

  function getById(id) {
    const matched = PROVIDERS.find((provider) => provider.id === id);
    return matched ? normalizeProvider(matched) : null;
  }

  function list() {
    return PROVIDERS.map((provider) => normalizeProvider(provider));
  }

  global.ExportAIChatProviderRegistry = {
    findByUrl,
    getById,
    list
  };
})(globalThis);
