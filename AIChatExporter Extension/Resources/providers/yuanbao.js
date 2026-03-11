(function registerYuanbaoProvider(global) {
  global.ExportAIChatProviderRegistry.registerProvider({
    id: "yuanbao",
    name: "元宝",
    urlPatterns: ["yuanbao.tencent.com"],
    assistantIcon: {
      type: "image",
      src: "images/providers/yuanbao-logo.png",
      alt: "Yuanbao"
    },
    profile: {
      titleStrategy: "document-first",
      titleSelectors: [
        "title",
        ".agent-chat__list__item[data-conv-speaker='human'] .hyc-content-text"
      ],
      titleFallback: "first-user-message",
      userMessageSelectors: [
        ".agent-chat__list__item[data-conv-speaker='human']"
      ],
      assistantMessageSelectors: [
        ".agent-chat__list__item[data-conv-speaker='ai']"
      ],
      messageRootSelectors: [
        ".agent-chat__list__item[data-conv-speaker]"
      ],
      minimumMessageCount: 2,
      contentRootSelectors: [
        ".hyc-common-markdown",
        ".hyc-component-text",
        ".agent-chat__bubble__content"
      ],
      roleAttributes: ["data-conv-speaker"],
      roleSelectors: [
        { selector: ".agent-chat__list__item[data-conv-speaker='human']", role: "user" },
        { selector: ".agent-chat__list__item[data-conv-speaker='ai']", role: "assistant" }
      ],
      userRoleHints: ["我", "请", "human"],
      markdownHeading: "Yuanbao Conversation",
      disableDefaultArticleFallback: true
    }
  });
})(globalThis);
