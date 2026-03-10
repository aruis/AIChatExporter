(function registerGeminiProvider(global) {
  global.ExportAIChatProviderRegistry.registerProvider({
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
  });
})(globalThis);
