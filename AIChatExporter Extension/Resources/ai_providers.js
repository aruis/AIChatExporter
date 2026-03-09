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
    roleSelectors: [],
    userRoleHints: ["you said", "你说", "你:"],
    markdownHeading: "AI Conversation",
    disableDefaultArticleFallback: false
  };

  const PROVIDERS = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      urlPatterns: ["chatgpt.com", "chat.openai.com"],
      assistantIcon: {
        type: "image",
        src: "images/providers/chatgpt-logo.svg",
        alt: "ChatGPT"
      },
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
        markdownHeading: "ChatGPT Conversation",
        preferDocumentTitle: true
      }
    },
    {
      id: "claude",
      name: "Claude",
      urlPatterns: ["claude.ai"],
      assistantIcon: {
        type: "monogram",
        text: "C"
      },
      profile: {
        titleSelectors: ["main h1", "header h1", "h1"],
        messageRootSelectors: [
          "main [data-testid*='message']",
          "main [data-testid*='conversation']",
          "main article"
        ],
        minimumMessageCount: 2,
        contentSelectors: [
          "[data-testid*='message'] [class*='prose']",
          "[data-testid*='message'] .markdown",
          ".markdown",
          "[class*='prose']",
          "div[dir='auto']"
        ],
        roleAttributes: ["data-role", "data-message-author-role", "data-turn"],
        roleSelectors: [
          { selector: "[data-role='human']", role: "user" },
          { selector: "[data-role='assistant']", role: "assistant" },
          { selector: "[data-message-author-role='user']", role: "user" },
          { selector: "[data-message-author-role='assistant']", role: "assistant" }
        ],
        userRoleHints: ["you said", "你说", "human"],
        markdownHeading: "Claude Conversation"
      }
    },
    {
      id: "gemini",
      name: "Gemini",
      urlPatterns: ["gemini.google.com", "aistudio.google.com"],
      assistantIcon: {
        type: "image",
        src: "images/providers/gemini-logo.svg",
        alt: "Gemini"
      },
      profile: {
        titleSelectors: [
          "main h1",
          "header h1",
          "div[role='heading']",
          "h1"
        ],
        messageRootSelectors: [
          "main model-response, main user-query",
          "model-response, user-query",
          "main [data-message-id]",
          "main [data-turn]",
          "main article"
        ],
        minimumMessageCount: 2,
        contentSelectors: [
          ".model-response-text .markdown",
          ".response-content .markdown",
          ".query-text",
          ".user-query-text",
          ".message-content .markdown",
          ".markdown",
          "[class*='prose']",
          ".message-content",
          "div[dir='auto']"
        ],
        roleAttributes: ["data-turn", "data-message-author-role", "data-role"],
        roleSelectors: [
          { selector: "user-query", role: "user" },
          { selector: "model-response", role: "assistant" },
          { selector: "[data-turn='user']", role: "user" },
          { selector: "[data-turn='assistant']", role: "assistant" },
          { selector: "[data-role='user']", role: "user" },
          { selector: "[data-role='assistant']", role: "assistant" }
        ],
        userRoleHints: ["you said", "你说", "you", "me"],
        markdownHeading: "Gemini Conversation"
      }
    },
    {
      id: "perplexity",
      name: "Perplexity",
      urlPatterns: ["perplexity.ai", "www.perplexity.ai"],
      assistantIcon: {
        type: "monogram",
        text: "P"
      },
      profile: {
        titleSelectors: ["main h1", "header h1", "h1"],
        messageRootSelectors: [
          "main [id^='markdown-content-']",
          "main [id*='markdown-content-']",
          "main [data-testid='answer']",
          "main [data-testid*='answer']",
          "main article[data-testid*='answer']"
        ],
        minimumMessageCount: 1,
        contentSelectors: [
          "[id^='markdown-content-']",
          "[id*='markdown-content-']",
          "[data-testid*='answer'] .prose",
          "[data-testid*='answer'] .markdown",
          "[data-testid*='answer'] [class*='prose']"
        ],
        roleAttributes: ["data-role", "data-message-author-role", "data-turn"],
        roleSelectors: [
          { selector: "[data-testid*='query']", role: "user" },
          { selector: "[data-testid*='question']", role: "user" },
          { selector: "[data-testid*='answer']", role: "assistant" }
        ],
        userRoleHints: ["you asked", "你问", "question"],
        markdownHeading: "Perplexity Conversation",
        disableDefaultArticleFallback: true
      }
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
