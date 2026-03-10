(function registerClaudeProvider(global) {
  global.ExportAIChatProviderRegistry.registerProvider({
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
  });
})(globalThis);
