(function registerKimiProvider(global) {
  global.ExportAIChatProviderRegistry.registerProvider({
    id: "kimi",
    name: "Kimi",
    urlPatterns: ["kimi.com", "www.kimi.com"],
    assistantIcon: {
      type: "image",
      src: "images/providers/kimi-logo.svg",
      alt: "Kimi"
    },
    profile: {
      titleStrategy: "document-first",
      titleSelectors: [
        ".chat-header-content h2",
        ".chat-header h2",
        "header h2",
        "h2"
      ],
      userMessageSelectors: [
        ".chat-content-item.chat-content-item-user"
      ],
      assistantMessageSelectors: [
        ".chat-content-item.chat-content-item-assistant"
      ],
      messageRootSelectors: [
        ".chat-content-list .chat-content-item",
        ".chat-detail-main .chat-content-item"
      ],
      minimumMessageCount: 2,
      contentRootSelectors: [
        ".user-content",
        ".markdown-container .markdown",
        ".markdown",
        ".segment-content-box"
      ],
      roleSelectors: [
        { selector: ".chat-content-item-user", role: "user" },
        { selector: ".chat-content-item-assistant", role: "assistant" }
      ],
      userRoleHints: ["你", "user"],
      markdownHeading: "Kimi Conversation",
      disableDefaultArticleFallback: true
    }
  });
})(globalThis);
