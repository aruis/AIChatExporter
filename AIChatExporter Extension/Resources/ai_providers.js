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
        titleStrategy: "document-first",
        titleSelectors: ["main h1", "h1"],
        messageRootSelectors: [
          "main article[data-turn]",
          "main [data-message-author-role]",
          "main article"
        ],
        minimumMessageCount: 2,
        contentRootSelectors: [
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
      urlPatterns: ["claude.ai"],
      assistantIcon: {
        type: "image",
        src: "images/providers/claude-logo.svg",
        alt: "Claude"
      },
      profile: {
        titleSelectors: ["main h1", "header h1", "h1"],
        messageRootSelectors: [
          "main [data-testid*='message']",
          "main [data-testid*='conversation']",
          "main article"
        ],
        minimumMessageCount: 2,
        contentRootSelectors: [
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
        contentRootSelectors: [
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
        type: "image",
        src: "images/providers/perplexity-logo.svg",
        alt: "Perplexity"
      },
      profile: {
        titleStrategy: "document-first",
        titleSelectors: [
          "main h1.group\\/query span",
          "main h1.group\\/query",
          "main h1",
          "header h1",
          "h1"
        ],
        userMessageSelectors: [
          "main div.bg-subtle.rounded-2xl.flex.items-center.justify-center > span.select-text.break-words",
          "main h1.group\\/query span",
          "main h1[class*='group/query'] span"
        ],
        assistantMessageSelectors: [
          "main [id^='markdown-content-']",
          "main [id*='markdown-content-']",
          "main [data-testid='answer']",
          "main [data-testid*='answer']",
          "main article[data-testid*='answer']"
        ],
        messageRootSelectors: [
          "main [id^='markdown-content-']",
          "main [id*='markdown-content-']",
          "main [data-testid='answer']",
          "main [data-testid*='answer']",
          "main article[data-testid*='answer']"
        ],
        minimumMessageCount: 1,
        contentRootSelectors: [
          "[id^='markdown-content-']",
          "[id*='markdown-content-']",
          "[data-testid*='answer'] .prose",
          "[data-testid*='answer'] .markdown",
          "[data-testid*='answer'] [class*='prose']"
        ],
        roleAttributes: ["data-role", "data-message-author-role", "data-turn"],
        roleSelectors: [
          { selector: "div.bg-subtle.rounded-2xl.flex.items-center.justify-center > span.select-text.break-words", role: "user" },
          { selector: "h1.group\\/query span", role: "user" },
          { selector: "h1[class*='group/query'] span", role: "user" },
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
