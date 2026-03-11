(function attachContentMarkdownSerializer(global) {
  const namespace = global.ExportAIChatContent || (global.ExportAIChatContent = {});
  const runtime = namespace.runtime;

  function detectCodeLanguage(preNode) {
    const codeNode = preNode.querySelector("code");
    const bucket = [preNode, codeNode].filter(Boolean);
    for (const node of bucket) {
      const className = node.className || "";
      const matched = className.match(/language-([a-zA-Z0-9_+-]+)/);
      if (matched?.[1]) {
        return matched[1];
      }
    }
    return "";
  }

  function toFencedCode(preNode) {
    const raw = preNode.innerText || preNode.textContent || "";
    const code = raw.trimEnd();
    if (!code) {
      return "";
    }
    const lang = detectCodeLanguage(preNode);
    return `\n\n\`\`\`${lang}\n${code}\n\`\`\``;
  }

  function getPrimaryContentNode(root, provider) {
    const candidates = provider?.profile?.contentRootSelectors
      || provider?.profile?.contentSelectors
      || [
      ".text-message .whitespace-pre-wrap",
      ".markdown",
      "[class*='prose']",
      ".text-message"
    ];

    for (const selector of candidates) {
      const found = root.querySelector(selector);
      if (found) {
        return found;
      }
    }

    return root;
  }

  function normalizeInlineText(value) {
    return String(value || "").replace(/\u00a0/g, " ");
  }

  function escapeMarkdownText(value) {
    return String(value || "").replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
  }

  function normalizeMathCopyText(value, preferBlock = false) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    const inlineMatched = raw.match(/^\\\(([\s\S]*)\\\)$/);
    if (inlineMatched?.[1]) {
      const body = inlineMatched[1].trim();
      return preferBlock ? `$$${body}$$` : `$${body}$`;
    }

    const blockMatched = raw.match(/^\\\[([\s\S]*)\\\]$/);
    if (blockMatched?.[1]) {
      return `$$${blockMatched[1].trim()}$$`;
    }

    return preferBlock ? `$$${raw}$$` : raw;
  }

  function isKaTeXNode(node) {
    return Boolean(node?.matches?.(".ybc-markdown-katex, .katex-display, .katex"));
  }

  function hasKaTeXMarkup(node) {
    return isKaTeXNode(node)
      || Boolean(node?.querySelector?.(".ybc-markdown-katex, .katex-display, .katex"));
  }

  function normalizeRenderedMathText(value) {
    return String(value || "")
      .replace(/\u200b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toMathMarkdown(node, preferBlock = false) {
    const raw = node?.getAttribute?.("data-custom-copy-text") || "";
    if (raw) {
      return normalizeMathCopyText(raw, preferBlock);
    }

    const rendered = normalizeRenderedMathText(node?.textContent || "");
    if (!rendered) {
      return "";
    }
    return preferBlock ? `$$${rendered}$$` : `$${rendered}$`;
  }

  function isStandaloneMathBlock(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    const meaningfulChildren = [...node.childNodes].filter((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return Boolean(String(child.textContent || "").trim());
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      return true;
    });

    return meaningfulChildren.length === 1
      && meaningfulChildren[0].nodeType === Node.ELEMENT_NODE
      && meaningfulChildren[0].getAttribute?.("data-custom-copy-text");
  }

  function toInlineMarkdown(node) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeInlineText(node.textContent);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node;
    const tag = el.tagName.toLowerCase();
    if (el.hasAttribute("data-custom-copy-text")) {
      return toMathMarkdown(el, false);
    }
    if (isKaTeXNode(el)) {
      return toMathMarkdown(el, false);
    }
    if (tag === "br") {
      return "\n";
    }

    const children = [...el.childNodes].map((child) => toInlineMarkdown(child)).join("");
    const text = children.trim();
    if (!text) {
      return "";
    }

    if (tag === "strong" || tag === "b") {
      return `**${text}**`;
    }
    if (tag === "em" || tag === "i") {
      return `*${text}*`;
    }
    if (tag === "del" || tag === "s") {
      return `~~${text}~~`;
    }
    if (tag === "code") {
      return text.includes("`") ? `\`\`${text}\`\`` : `\`${text}\``;
    }
    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      return href ? `[${text}](${href})` : text;
    }
    if (tag === "img") {
      const alt = el.getAttribute("alt") || "";
      const src = el.getAttribute("src") || "";
      if (!src) {
        return alt ? escapeMarkdownText(alt) : "";
      }
      return `![${escapeMarkdownText(alt)}](${src})`;
    }

    return children;
  }

  function mergeInlineText(node) {
    return toInlineMarkdown(node)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .trim();
  }

  function detectTaskState(li) {
    const checkbox = li.querySelector(":scope > input[type='checkbox'], :scope > label input[type='checkbox']");
    if (!checkbox) {
      return null;
    }
    return checkbox.checked ? "x" : " ";
  }

  function serializeList(listEl, indentLevel = 0, ordered = false) {
    const liNodes = [...listEl.children].filter((item) => item.tagName?.toLowerCase() === "li");
    const lines = [];
    const start = ordered ? Math.max(1, Number.parseInt(listEl.getAttribute("start") || "1", 10) || 1) : 1;

    liNodes.forEach((li, index) => {
      const prefixBase = "  ".repeat(indentLevel);
      const marker = ordered ? `${start + index}.` : "-";
      const nestedLists = [];
      const bodyParts = [];
      const taskState = detectTaskState(li);

      [...li.childNodes].forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          if (tag === "input" && child.getAttribute("type") === "checkbox") {
            return;
          }
          if (tag === "label") {
            const labelClone = child.cloneNode(true);
            labelClone.querySelectorAll("input[type='checkbox']").forEach((el) => el.remove());
            const labelInline = mergeInlineText(labelClone);
            if (labelInline) {
              bodyParts.push(labelInline);
            }
            return;
          }
          if (tag === "ul" || tag === "ol") {
            nestedLists.push(serializeList(child, indentLevel + 1, tag === "ol"));
            return;
          }
        }
        const inline = mergeInlineText(child);
        if (inline) {
          bodyParts.push(inline);
        }
      });

      const body = bodyParts.join(" ").trim();
      const taskPrefix = taskState !== null ? `[${taskState}] ` : "";
      lines.push(`${prefixBase}${marker} ${taskPrefix}${body}`.trimEnd());
      nestedLists.filter(Boolean).forEach((block) => lines.push(block));
    });

    return lines.join("\n");
  }

  function serializeTable(tableEl) {
    const rowEls = [...tableEl.querySelectorAll("tr")];
    if (!rowEls.length) {
      return "";
    }

    const rows = rowEls.map((tr) =>
      [...tr.querySelectorAll("th,td")].map((cell) => mergeInlineText(cell).replace(/\n/g, "<br>").trim())
    ).filter((row) => row.length > 0);
    if (!rows.length) {
      return "";
    }

    const width = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => {
      const next = [...row];
      while (next.length < width) {
        next.push("");
      }
      return next;
    });

    const header = normalizedRows[0];
    const body = normalizedRows.slice(1);
    const headerLine = `| ${header.join(" | ")} |`;
    const dividerLine = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
    const bodyLines = body.map((row) => `| ${row.join(" | ")} |`);
    return [headerLine, dividerLine, ...bodyLines].join("\n");
  }

  function serializeChildrenMarkdown(root) {
    const blocks = [];
    [...root.childNodes].forEach((child) => {
      const block = toBlockMarkdown(child).trim();
      if (block) {
        blocks.push(block);
      }
    });
    return blocks.join("\n\n");
  }

  function hasBlockDescendants(el) {
    return [...el.children].some((child) => {
      const childTag = child.tagName.toLowerCase();
      if (["p", "pre", "ul", "ol", "blockquote", "table", "hr"].includes(childTag) || /^h[1-6]$/.test(childTag)) {
        return true;
      }
      return child.querySelector("p, pre, ul, ol, blockquote, table, hr, h1, h2, h3, h4, h5, h6");
    });
  }

  function toBlockMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return mergeInlineText(node);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node;
    const tag = el.tagName.toLowerCase();
    if (el.hasAttribute("data-custom-copy-text")) {
      return toMathMarkdown(el, isStandaloneMathBlock(el.parentElement));
    }
    if (tag === "pre" && hasKaTeXMarkup(el)) {
      return toMathMarkdown(el, true);
    }
    if (isKaTeXNode(el) && !el.querySelector?.("pre")) {
      return toMathMarkdown(el, isStandaloneMathBlock(el.parentElement) || el.matches?.(".katex-display"));
    }

    if (tag === "pre") {
      return toFencedCode(el).trim();
    }
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      return `${"#".repeat(level)} ${mergeInlineText(el)}`.trim();
    }
    if (tag === "ul" || tag === "ol") {
      return serializeList(el, 0, tag === "ol");
    }
    if (tag === "blockquote") {
      const content = serializeChildrenMarkdown(el);
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join("\n");
    }
    if (tag === "table") {
      return serializeTable(el);
    }
    if (tag === "hr") {
      return "---";
    }
    if (tag === "p") {
      if (isStandaloneMathBlock(el)) {
        return toMathMarkdown(el.firstElementChild, true);
      }
      return mergeInlineText(el);
    }
    if (isStandaloneMathBlock(el)) {
      return toMathMarkdown(el.firstElementChild, true);
    }

    const hasBlockChildren = hasBlockDescendants(el);
    return hasBlockChildren ? serializeChildrenMarkdown(el) : mergeInlineText(el);
  }

  function nodeToMarkdown(root, provider) {
    const contentNode = getPrimaryContentNode(root, provider);
    const clone = contentNode.cloneNode(true);
    clone.querySelectorAll("button, nav, svg, script, style").forEach((el) => el.remove());
    clone.querySelectorAll("pre").forEach((pre) => {
      let current = pre;
      while (current && current.parentElement && current.parentElement !== clone) {
        const container = current.parentElement;
        [...container.children].forEach((child) => {
          if (child !== current && !child.contains(current)) {
            child.remove();
          }
        });
        current = container;
      }
    });

    if (clone.matches?.(".whitespace-pre-wrap") && !clone.querySelector("p,ul,ol,table,blockquote,pre")) {
      return runtime.cleanText(clone.innerText || clone.textContent || "");
    }

    const markdown = serializeChildrenMarkdown(clone) || mergeInlineText(clone);
    return runtime.cleanText(markdown);
  }

  namespace.serializer = {
    nodeToMarkdown
  };
})(globalThis);
