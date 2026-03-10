(function registerChatGPTProvider(global) {
  global.ExportAIChatProviderRegistry.registerProvider({
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
  });
})(globalThis);
