(function attachContentExtractors(global) {
  const namespace = global.ExportAIChatContent || (global.ExportAIChatContent = {});
  const runtime = namespace.runtime;
  const serializer = namespace.serializer;

  function sortNodesInDocumentOrder(nodes) {
    return [...nodes].sort((left, right) => {
      if (left === right) {
        return 0;
      }
      const position = left.compareDocumentPosition(right);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }
      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }
      return 0;
    });
  }

  function collectNodesBySelectors(selectors) {
    const unique = new Set();
    for (const selector of selectors || []) {
      if (!selector) {
        continue;
      }
      try {
        document.querySelectorAll(selector).forEach((node) => unique.add(node));
      } catch {
        // Ignore invalid selectors in provider config.
      }
    }
    return sortNodesInDocumentOrder(unique);
  }

  function getExplicitMessageRoots(provider) {
    const userNodes = collectNodesBySelectors(provider?.profile?.userMessageSelectors);
    const assistantNodes = collectNodesBySelectors(provider?.profile?.assistantMessageSelectors);
    const total = userNodes.length + assistantNodes.length;
    const minCount = Number.isFinite(provider?.profile?.minimumMessageCount)
      ? provider.profile.minimumMessageCount
      : 2;

    if (!total || total < minCount) {
      return [];
    }

    const roleMap = new Map();
    userNodes.forEach((node) => roleMap.set(node, "user"));
    assistantNodes.forEach((node) => roleMap.set(node, "assistant"));

    const nodes = sortNodesInDocumentOrder(new Set([...userNodes, ...assistantNodes]));
    return nodes.map((node) => ({
      node,
      role: roleMap.get(node) || null
    }));
  }

  function getMessageRoots(provider) {
    const explicitRoots = getExplicitMessageRoots(provider);
    if (explicitRoots.length) {
      return explicitRoots;
    }

    const selectors = provider?.profile?.messageRootSelectors || ["main article"];
    const minCount = Number.isFinite(provider?.profile?.minimumMessageCount)
      ? provider.profile.minimumMessageCount
      : 2;

    for (const selector of selectors) {
      const nodes = collectNodesBySelectors([selector]);
      if (nodes.length >= minCount) {
        return nodes.map((node) => ({ node, role: null }));
      }
    }

    const disableDefaultFallback = Boolean(provider?.profile?.disableDefaultArticleFallback);
    if (!disableDefaultFallback) {
      const fallbackNodes = collectNodesBySelectors(["main article"]);
      if (fallbackNodes.length >= minCount) {
        return fallbackNodes.map((node) => ({ node, role: null }));
      }
    }

    if (provider?.id === "perplexity") {
      const perplexityRoots = collectNodesBySelectors(["main [id^='markdown-content-']"]);
      if (perplexityRoots.length >= 1) {
        return perplexityRoots.map((node) => ({ node, role: "assistant" }));
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

  function toSerializableMessages(messages) {
    return messages.map((item) => ({
      role: item.role,
      text: item.text
    }));
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

  function detectRole(node, provider, preferredRole = null) {
    if (preferredRole === "user" || preferredRole === "assistant" || preferredRole === "tool") {
      return preferredRole;
    }

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
    for (const item of roots) {
      const root = item?.node || item;
      const text = serializer.nodeToMarkdown(root, provider);
      if (!text) {
        continue;
      }
      messages.push({
        role: detectRole(root, provider, item?.role || null),
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
      messages: toSerializableMessages(normalizedMessages),
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
