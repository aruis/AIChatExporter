(function registerPerplexityProvider(global) {
  global.ExportAIChatProviderRegistry.registerProvider({
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
  });
})(globalThis);
