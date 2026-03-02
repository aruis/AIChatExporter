export function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

let runtimeReadyPromise = null;

function waitUntilReady(isReady, timeoutMs = 6000, intervalMs = 40) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (isReady()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error("运行时就绪超时"));
      }
    }, intervalMs);
  });
}

function findScriptBySrc(src) {
  return [...document.querySelectorAll("script")].find((node) => node.src === src) || null;
}

function loadScript(src, isReady, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    if (isReady()) {
      resolve();
      return;
    }

    const existing = findScriptBySrc(src);
    if (existing) {
      waitUntilReady(isReady, timeoutMs).then(resolve).catch(() => {
        reject(new Error(`脚本已存在但运行时未就绪: ${src}`));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", () => {
      if (isReady()) {
        resolve();
      } else {
        reject(new Error(`脚本已加载但运行时未就绪: ${src}`));
      }
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`脚本加载失败: ${src}`)), { once: true });
    document.head.appendChild(script);
    setTimeout(() => {
      if (!isReady()) {
        reject(new Error(`脚本加载超时: ${src}`));
      }
    }, timeoutMs);
  });
}

export async function ensureMarkdownRuntime() {
  if (typeof globalThis.markdownit === "function" && typeof globalThis.DOMPurify?.sanitize === "function") {
    return;
  }

  if (!runtimeReadyPromise) {
    runtimeReadyPromise = (async () => {
      const base = new URL("./", import.meta.url);
      await loadScript(new URL("vendor/markdown-it.min.js", base).href, () => typeof globalThis.markdownit === "function");
      await loadScript(
        new URL("vendor/markdown-it-task-lists.min.js", base).href,
        () => typeof globalThis.markdownitTaskLists === "function" || typeof globalThis.markdownitTasklist === "function"
      );
      await loadScript(
        new URL("vendor/purify.min.js", base).href,
        () => typeof globalThis.DOMPurify?.sanitize === "function"
      );
    })();
  }

  await runtimeReadyPromise;
}

export function createMarkdownRenderer() {
  const markdownitFactory = globalThis.markdownit;
  if (typeof markdownitFactory !== "function") {
    throw new Error("Markdown 引擎加载失败：markdown-it 未就绪（ensureMarkdownRuntime 未完成）");
  }

  const md = markdownitFactory({
    html: false,
    breaks: true,
    linkify: true,
    typographer: false
  });

  const taskListPlugin = globalThis.markdownitTaskLists || globalThis.markdownitTasklist;
  if (typeof taskListPlugin === "function") {
    md.use(taskListPlugin, {
      enabled: false,
      label: true,
      labelAfter: true
    });
  }

  const originalLinkOpen = md.renderer.rules.link_open
    || ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
    return originalLinkOpen(tokens, idx, opts, env, self);
  };

  return (source) => {
    const normalized = normalizeNewlines(source);
    const rawHtml = md.render(normalized);
    const purifier = globalThis.DOMPurify;
    if (!purifier || typeof purifier.sanitize !== "function") {
      throw new Error("Markdown 渲染器未就绪：DOMPurify 不可用");
    }
    return purifier.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
      ADD_ATTR: ["target", "rel"]
    });
  };
}
