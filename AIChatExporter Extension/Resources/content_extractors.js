(function attachContentExtractors(global) {
  const namespace = global.ExportAIChatContent || (global.ExportAIChatContent = {});
  const runtime = namespace.runtime;
  const serializer = namespace.serializer;

  function getMessageRoots(provider) {
    const selectors = provider?.profile?.messageRootSelectors || ["main article"];
    const minCount = Number.isFinite(provider?.profile?.minimumMessageCount)
      ? provider.profile.minimumMessageCount
      : 2;

    for (const selector of selectors) {
      const nodes = [...document.querySelectorAll(selector)];
      if (nodes.length >= minCount) {
        return nodes;
      }
    }

    const disableDefaultFallback = Boolean(provider?.profile?.disableDefaultArticleFallback);
    if (!disableDefaultFallback) {
      const fallbackNodes = [...document.querySelectorAll("main article")];
      if (fallbackNodes.length >= minCount) {
        return fallbackNodes;
      }
    }

    if (provider?.id === "perplexity") {
      const perplexityRoots = [...document.querySelectorAll("main [id^='markdown-content-']")];
      if (perplexityRoots.length >= 1) {
        return perplexityRoots;
      }
    }
    return [];
  }

  function isPerplexityFollowUpNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    const selectors = [
      "[data-testid*='related']",
      "[data-testid*='follow']",
      "[data-testid*='suggest']",
      "[aria-label*='Follow-up']",
      "[aria-label*='Related']"
    ];

    if (selectors.some((selector) => node.matches?.(selector) || node.closest?.(selector))) {
      return true;
    }

    const text = runtime.cleanText(node.innerText || node.textContent || "");
    const shortText = text.slice(0, 64);
    return shortText === "后续提问" || shortText === "Follow-up questions";
  }

  function postProcessMessages(messages, provider) {
    if (provider?.id !== "perplexity") {
      return messages;
    }

    return messages.filter((item) => {
      const text = String(item?.text || "").trim();
      if (!text) {
        return false;
      }
      if (isPerplexityFollowUpNode(item?.root)) {
        return false;
      }
      return true;
    });
  }

  function readRoleValue(node, attrName) {
    const value = node.getAttribute?.(attrName);
    if (value === "user" || value === "assistant" || value === "tool") {
      return value;
    }
    return null;
  }

  function readRoleFromSelectors(node, roleSelectors) {
    for (const row of roleSelectors) {
      const selector = String(row?.selector || "").trim();
      const role = row?.role;
      if (!selector || (role !== "user" && role !== "assistant" && role !== "tool")) {
        continue;
      }

      try {
        if (node.matches?.(selector) || node.closest?.(selector)) {
          return role;
        }
      } catch {
        // Ignore invalid selector rows and keep evaluating fallback rules.
      }
    }
    return null;
  }

  function detectRole(node, provider) {
    const roleAttrs = provider?.profile?.roleAttributes || ["data-turn", "data-message-author-role"];
    const roleSelectors = Array.isArray(provider?.profile?.roleSelectors) ? provider.profile.roleSelectors : [];
    const selectorRole = readRoleFromSelectors(node, roleSelectors);
    if (selectorRole) {
      return selectorRole;
    }

    for (const attr of roleAttrs) {
      const direct = readRoleValue(node, attr);
      if (direct) {
        return direct;
      }
    }
    for (const attr of roleAttrs) {
      const host = node.closest?.(`[${attr}]`);
      const role = host ? readRoleValue(host, attr) : null;
      if (role) {
        return role;
      }
    }

    const hints = provider?.profile?.userRoleHints || ["you said", "你说", "你:"];
    const text = (node.textContent || "").slice(0, 320).toLowerCase();
    if (hints.some((hint) => text.includes(String(hint).toLowerCase()))) {
      return "user";
    }
    return "assistant";
  }

  function extractConversation(provider) {
    const roots = getMessageRoots(provider);
    if (!roots.length) {
      throw new Error(`未识别到 ${provider.name} 对话内容，请在可见会话页面使用`);
    }

    const messages = [];
    for (const root of roots) {
      const text = serializer.nodeToMarkdown(root, provider);
      if (!text) {
        continue;
      }
      messages.push({
        role: detectRole(root, provider),
        text,
        root
      });
    }

    const normalizedMessages = postProcessMessages(messages, provider);

    if (!normalizedMessages.length) {
      throw new Error("对话为空，无法导出");
    }

    return {
      title: runtime.detectTitle(provider),
      messages: normalizedMessages,
      providerId: provider.id,
      providerName: provider.name
    };
  }

  function buildMarkdown(messages, provider) {
    const heading = provider?.profile?.markdownHeading || `${provider?.name || "AI"} Conversation`;
    const lines = [`# ${heading}`, ""];

    for (const item of messages) {
      const roleTitle = item.role === "user" ? "User" : item.role === "assistant" ? "Assistant" : "Tool";
      lines.push(`## ${roleTitle}`);
      lines.push("");
      lines.push(item.text);
      lines.push("");
    }

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  namespace.extractors = {
    extractConversation,
    buildMarkdown
  };
})(globalThis);
