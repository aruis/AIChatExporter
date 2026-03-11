(function registerDoubaoProvider(global) {
  global.ExportAIChatProviderRegistry.registerProvider({
    id: "doubao",
    name: "豆包",
    urlPatterns: ["doubao.com", "www.doubao.com"],
    assistantIcon: {
      type: "monogram",
      text: "豆包"
    },
    profile: {
      titleStrategy: "document-first",
      titleSelectors: [
        "a[aria-current='page'] [data-testid='chat_list_item_title']"
      ],
      titleFallback: "first-user-message",
      userMessageSelectors: [
        "[data-testid='send_message']",
        "[data-testid='message-block-container'] [data-testid='send_message']"
      ],
      assistantMessageSelectors: [
        "[data-testid='receive_message']",
        "[data-testid='message-block-container'] [data-testid='receive_message']"
      ],
      messageRootSelectors: [
        "[data-testid='send_message'], [data-testid='receive_message']",
        "[data-testid='message-block-container'] [data-testid='send_message'], [data-testid='message-block-container'] [data-testid='receive_message']"
      ],
      minimumMessageCount: 2,
      contentRootSelectors: [
        "[data-testid='message_text_content']",
        "[data-testid='message_content'] [data-testid='message_text_content']",
        "[data-testid='message_content']"
      ],
      roleSelectors: [
        { selector: "[data-testid='send_message']", role: "user" },
        { selector: "[data-testid='receive_message']", role: "assistant" }
      ],
      userRoleHints: ["你", "用户"],
      markdownHeading: "Doubao Conversation",
      disableDefaultArticleFallback: true
    }
  });
})(globalThis);
