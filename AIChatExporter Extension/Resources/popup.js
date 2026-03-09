import { createMarkdownRenderer, ensureMarkdownRuntime } from "./markdown_renderer.js";

const ext = globalThis.browser ?? globalThis.chrome;
const EXPORT_BUILD_TAG = "dbg-20260301-c3";
const SHOW_BUILD_TAG = new URLSearchParams(location.search).get("debug") === "1";
const NATIVE_APP_ID = "net.ximatai.aichatexporter";
const WORKBENCH_PRO_HINT = "自定义导出样式为 Pro 功能，请先完成内购解锁。";

const CHAT_STYLE_OPTIONS = [
  { id: "bubble", label: "气泡卡片" },
  { id: "minimal", label: "极简线条" },
  { id: "glass", label: "磨砂玻璃" }
];

const BG_STYLE_OPTIONS = [
  { id: "paper", label: "浅色纸感" },
  { id: "mesh", label: "蓝绿渐变" },
  { id: "night", label: "深色夜幕" }
];

const ASSISTANT_MODE_OPTIONS = [
  { id: "icon", label: "图标" },
  { id: "title", label: "标题" }
];

let cachedProStatus = null;
let cachedProStatusAt = 0;
const PRO_STATUS_CACHE_TTL_MS = 10 * 1000;

function qs(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanText(value) {
  return String(value || "").trim();
}

function timestampKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getProviderRegistry() {
  const registry = globalThis.ExportAIChatProviderRegistry;
  if (!registry || typeof registry.findByUrl !== "function") {
    throw new Error("Provider 注册表未就绪，请刷新扩展后重试");
  }
  return registry;
}

async function getActiveTab() {
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs.length) {
    throw new Error("未找到当前标签页");
  }

  const [tab] = tabs;
  if (!tab.id) {
    throw new Error("当前标签页不可用");
  }

  return tab;
}

function resolveProviderForUrl(url) {
  const registry = getProviderRegistry();
  return registry.findByUrl(url || "");
}

function requireProviderForTab(tab) {
  const provider = resolveProviderForUrl(tab?.url || "");
  if (!provider) {
    throw new Error("当前网站暂不支持导出，请切换到已接入的 AI 对话页面");
  }
  return provider;
}

async function collectConversationFromActiveTab() {
  const tab = await getActiveTab();
  const provider = requireProviderForTab(tab);

  let response;
  try {
    response = await ext.tabs.sendMessage(tab.id, { action: "collect_conversation" });
  } catch (error) {
    throw new Error(`页面脚本未连接，请刷新 ${provider.name} 页面后重试`);
  }

  if (!response) {
    throw new Error("页面未返回对话数据，请刷新页面后重试");
  }

  if (!response?.ok) {
    throw new Error(response?.error || "读取对话失败");
  }

  return {
    title: response.title || "chat",
    messages: response.messages || [],
    providerId: response.providerId || provider.id,
    providerName: response.providerName || provider.name
  };
}

function setPopupStatus(message, isError = false) {
  const statusEl = qs("status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#115e59";
}

function setPopupBusy(isBusy) {
  const buttons = [...document.querySelectorAll(".export-btn")];
  buttons.forEach((btn) => {
    btn.disabled = isBusy;
  });
}

async function exportMarkdownFromPopup() {
  const tab = await getActiveTab();
  const provider = requireProviderForTab(tab);

  const response = await ext.tabs.sendMessage(tab.id, { action: "export_markdown" });
  if (!response?.ok) {
    throw new Error(response?.error || "导出失败");
  }

  return response.message || `${provider.name} Markdown 导出成功`;
}

async function openWorkbenchFromPopup() {
  await assertWorkbenchProAccess({ forceRefresh: true });

  const payload = await collectConversationFromActiveTab();
  if (!payload.messages.length) {
    throw new Error("对话为空，无法打开自定义导出样式");
  }

  const sid = `eac_workbench_${timestampKey()}`;
  await ext.storage.local.set({ [sid]: payload });

  const url = ext.runtime.getURL(`popup.html?mode=workbench&sid=${encodeURIComponent(sid)}`);
  await ext.tabs.create({ url });
  return "已打开自定义导出样式";
}

async function queryProStatus({ forceRefresh = false } = {}) {
  const now = Date.now();
  const cacheValid = (now - cachedProStatusAt) < PRO_STATUS_CACHE_TTL_MS;
  if (!forceRefresh && cachedProStatus !== null && cacheValid) {
    return cachedProStatus;
  }

  if (!ext?.runtime?.sendNativeMessage) {
    cachedProStatus = false;
    return cachedProStatus;
  }

  try {
    const response = await ext.runtime.sendNativeMessage(NATIVE_APP_ID, { action: "get_pro_status" });
    cachedProStatus = Boolean(response?.ok && response?.isPro);
    cachedProStatusAt = now;
    return cachedProStatus;
  } catch {
    cachedProStatus = false;
    cachedProStatusAt = now;
    return cachedProStatus;
  }
}

async function assertWorkbenchProAccess({ forceRefresh = false } = {}) {
  const isPro = await queryProStatus({ forceRefresh });
  if (!isPro) {
    throw new Error(WORKBENCH_PRO_HINT);
  }
}

async function applyWorkbenchProGuard({ forceRefresh = false } = {}) {
  const workbenchButton = document.querySelector("[data-action='open_workbench']");
  if (!workbenchButton) {
    return;
  }

  const isPro = await queryProStatus({ forceRefresh });
  if (isPro) {
    workbenchButton.classList.remove("is-locked");
    workbenchButton.title = "";
    return;
  }

  workbenchButton.classList.add("is-locked");
  workbenchButton.title = WORKBENCH_PRO_HINT;
}

function bindPopupActions() {
  const buttons = [...document.querySelectorAll(".export-btn")];

  for (const button of buttons) {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (!action) {
        return;
      }

      setPopupBusy(true);
      setPopupStatus("处理中...");

      try {
        let message = "";
        if (action === "export_markdown") {
          message = await exportMarkdownFromPopup();
        } else if (action === "open_workbench") {
          message = await openWorkbenchFromPopup();
        } else {
          return;
        }
        setPopupStatus(message);
      } catch (error) {
        const message = error?.message || String(error);
        if (action === "open_workbench" && message === WORKBENCH_PRO_HINT) {
          await applyWorkbenchProGuard({ forceRefresh: true });
          const isProAfterRefresh = await queryProStatus({ forceRefresh: true });
          if (isProAfterRefresh) {
            try {
              const retryMessage = await openWorkbenchFromPopup();
              setPopupStatus(retryMessage);
              return;
            } catch (retryError) {
              setPopupStatus(retryError?.message || String(retryError), true);
              return;
            }
          }
        }
        setPopupStatus(message, true);
      } finally {
        setPopupBusy(false);
      }
    });
  }
}

let markdownRenderer = null;

function renderMarkdownToHtml(input) {
  if (!markdownRenderer) {
    markdownRenderer = createMarkdownRenderer();
  }
  return markdownRenderer(input || "");
}

function normalizeRoleTitle(value, fallback) {
  const text = cleanText(value || "");
  return text ? text.slice(0, 24) : fallback;
}

function normalizeConversationTitle(value, fallback = "chat") {
  const text = cleanText(value || "");
  return text ? text.slice(0, 80) : fallback;
}

function maybeBuildTagSuffix() {
  return SHOW_BUILD_TAG ? ` · ${EXPORT_BUILD_TAG}` : "";
}

function getProviderIconModel(providerId, providerName) {
  const registry = globalThis.ExportAIChatProviderRegistry;
  const provider = registry?.getById?.(providerId) || null;
  const icon = provider?.assistantIcon || null;
  if (icon?.type === "image" && cleanText(icon.src || "")) {
    return {
      type: "image",
      src: icon.src,
      alt: cleanText(icon.alt || providerName || "Assistant")
    };
  }
  if (icon?.type === "monogram") {
    const text = cleanText(icon.text || "").slice(0, 4) || cleanText(providerName || "AI").slice(0, 2) || "AI";
    return { type: "monogram", text };
  }
  const fallback = cleanText(providerName || "AI").slice(0, 2) || "AI";
  return { type: "monogram", text: fallback };
}

function renderAssistantIcon(providerId, providerName) {
  const icon = getProviderIconModel(providerId, providerName);
  const providerClass = `provider-${escapeHtml(providerId || "unknown")}`;
  if (icon.type === "image") {
    const src = ext.runtime.getURL(icon.src);
    return `<span class="eac-assistant-icon ${providerClass} image-icon"><img src="${escapeHtml(src)}" alt="${escapeHtml(icon.alt)}"></span>`;
  }
  return `<span class="eac-assistant-icon ${providerClass}">${escapeHtml(icon.text)}</span>`;
}

function buildMessageListHtml(messages, state, provider) {
  const assistantMode = state.assistantMode === "title" ? "title" : "icon";
  const userTitle = normalizeRoleTitle(state.userTitle, "User");
  const assistantTitle = normalizeRoleTitle(state.assistantTitle, "Assistant");
  return messages.map((item) => {
    const role = item.role === "user" ? "user" : "assistant";
    const isAssistantIconMode = role === "assistant" && assistantMode === "icon";
    const badgeClass = isAssistantIconMode ? "eac-badge is-icon" : "eac-badge";
    const badgeContent = role === "user"
      ? escapeHtml(userTitle)
      : isAssistantIconMode
        ? renderAssistantIcon(provider?.id || "", provider?.name || "AI")
        : escapeHtml(assistantTitle);
    const body = renderMarkdownToHtml(item.text || "");

    return `
      <article class="eac-msg role-${role}">
        <div class="${badgeClass}">${badgeContent}</div>
        <div class="eac-bubble">${body}</div>
      </article>
    `;
  }).join("");
}

function renderWorkbenchHtml(data, state) {
  return `
    <header class="wb-header">
      <div>
        <h1>排版导出工作台</h1>
        <div class="wb-tag">${escapeHtml(state.conversationTitle)}${maybeBuildTagSuffix()}</div>
      </div>
      <button class="wb-back" data-action="close_tab">关闭</button>
    </header>

    <section class="wb-layout">
      <aside class="wb-panel">
        <h3 class="wb-group-title">对话框样式</h3>
        <div class="wb-option-row" id="chat-options"></div>

        <h3 class="wb-group-title">背景样式</h3>
        <div class="wb-option-row" id="bg-options"></div>

        <div class="wb-field">
          <label class="wb-label" for="conversation-title-input">对话标题</label>
          <input id="conversation-title-input" class="wb-input" type="text" maxlength="80" value="${escapeHtml(state.conversationTitle)}" placeholder="chat">
        </div>

        <h3 class="wb-group-title">角色显示</h3>
        <div class="wb-field">
          <label class="wb-label" for="assistant-title-input">Assistant 标识</label>
          <div class="wb-inline-field">
            <div class="wb-option-row compact" id="assistant-mode-options"></div>
            <input id="assistant-title-input" class="wb-input wb-inline-input" type="text" maxlength="24" value="${escapeHtml(state.assistantTitle)}" placeholder="${escapeHtml(state.providerName || "Assistant")}">
          </div>
        </div>
        <div class="wb-field">
          <label class="wb-label" for="user-title-input">User 标题</label>
          <input id="user-title-input" class="wb-input" type="text" maxlength="24" value="${escapeHtml(state.userTitle)}" placeholder="User">
        </div>

        <div class="wb-actions">
          <button class="wb-btn primary" data-action="export_png">导出 PNG</button>
          <button class="wb-btn" data-action="export_pdf">导出 PDF</button>
        </div>

        <div class="wb-status" id="wb-status"></div>
      </aside>

      <section class="wb-preview" id="wb-preview">
        <div class="eac-stage chat-${state.chatStyle} bg-${state.bgStyle}" id="wb-stage">
          <div class="eac-stage-header" id="wb-stage-header">
            <p class="eac-stage-title">${escapeHtml(state.conversationTitle)}</p>
            <p class="eac-stage-sub">Export AI Chat · ${escapeHtml(data.providerName || "AI")}${maybeBuildTagSuffix()}</p>
          </div>
          <div class="eac-stage-scroll" id="wb-stage-scroll">
            <div class="eac-stage-inner">
              ${buildMessageListHtml(data.messages, state, {
                id: data.providerId,
                name: data.providerName
              })}
            </div>
          </div>
        </div>
      </section>
    </section>
  `;
}

function fillStyleOptionButtons(container, options, activeId) {
  container.innerHTML = options.map((option) => `
    <button class="wb-option ${option.id === activeId ? "active" : ""}" data-id="${option.id}" type="button">${option.label}</button>
  `).join("");
}

function setWorkbenchStatus(message, isError = false) {
  const statusEl = qs("wb-status");
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#0f766e";
}

function setWorkbenchBusy(isBusy) {
  for (const btn of document.querySelectorAll("[data-action='export_png'], [data-action='export_pdf']")) {
    btn.disabled = isBusy;
  }
}

async function captureVisibleTab() {
  const response = await ext.runtime.sendMessage({ action: "capture_visible_tab" });
  if (!response?.ok || !response.dataUrl) {
    throw new Error(response?.error || "截图失败");
  }
  return response.dataUrl;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("截图帧加载失败"));
    image.src = dataUrl;
  });
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function setScrollTopAndRead(scrollEl, top) {
  // Safari behavior can differ between property assignment and scrollTo API.
  scrollEl.scrollTop = top;
  if (typeof scrollEl.scrollTo === "function") {
    try {
      scrollEl.scrollTo(0, top);
    } catch {
      // Ignore and rely on scrollTop fallback.
    }
  }
  await waitForNextFrame();
  await waitForNextFrame();
  return Math.max(0, Math.floor(scrollEl.scrollTop));
}

function buildScrollPositions(totalHeight, viewportHeight) {
  if (totalHeight <= viewportHeight + 2) {
    return [0];
  }

  const step = Math.max(1, Math.floor(viewportHeight));
  const maxStart = Math.max(0, totalHeight - viewportHeight);
  const positions = [];

  for (let y = 0; y < maxStart; y += step) {
    positions.push(y);
  }
  positions.push(maxStart);

  return [...new Set(positions.map((value) => Math.max(0, Math.floor(value))))];
}

function getExportInnerBackground(stageClassName) {
  if (stageClassName.includes("bg-night")) {
    return "rgb(15, 23, 42)";
  }
  return "rgb(255, 255, 255)";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPreviewToPng(data, state) {
  const stage = qs("wb-stage");
  const stageHeader = qs("wb-stage-header");
  const stageScroll = qs("wb-stage-scroll");
  const stageInner = stage.querySelector(".eac-stage-inner");

  const stageRect = stage.getBoundingClientRect();
  const headerRect = stageHeader.getBoundingClientRect();
  const scrollRect = stageScroll.getBoundingClientRect();

  const viewportHeight = stageScroll.clientHeight;
  const totalHeight = Math.max(viewportHeight, stageScroll.scrollHeight);
  const dpr = window.devicePixelRatio || 1;

  const outputWidth = Math.max(1, Math.round(stageRect.width * dpr));
  const outputHeaderHeight = Math.max(1, Math.round(headerRect.height * dpr));
  const outputHeight = Math.max(1, Math.round(totalHeight * dpr) + outputHeaderHeight);

  if (outputWidth > 30000 || outputHeight > 30000) {
    throw new Error("导出内容过长，PNG 画布超限，请优先导出 PDF");
  }

  const positions = buildScrollPositions(totalHeight, viewportHeight);
  const frames = [];
  const originalTop = stageScroll.scrollTop;
  const maxScrollable = Math.max(0, stageScroll.scrollHeight - stageScroll.clientHeight);
  if (maxScrollable <= 2 && stageInner.scrollHeight > stageScroll.clientHeight + 8) {
    throw new Error(
      `导出滚动容器异常：client=${stageScroll.clientHeight}, scroll=${stageScroll.scrollHeight}, inner=${stageInner.scrollHeight}`
    );
  }
  const originalInnerStyle = {
    background: stageInner.style.background,
    backdropFilter: stageInner.style.backdropFilter,
    boxShadow: stageInner.style.boxShadow
  };
  const stageClassName = stage.className || "";
  const exportInnerBackground = getExportInnerBackground(stageClassName);

  // Use an opaque export layer to avoid alpha stacking seams between stitched frames.
  // Keep color aligned with the current theme to reduce preview/export visual drift.
  stageInner.style.backdropFilter = "none";
  stageInner.style.boxShadow = "none";
  stageInner.style.background = exportInnerBackground;

  try {
    let lastRecordedTop = null;
    for (const top of positions) {
      const actualTop = await setScrollTopAndRead(stageScroll, top);
      if (top > 0 && maxScrollable > 2 && actualTop === 0) {
        throw new Error("导出滚动失败：预览区域未发生滚动，请重试");
      }
      if (lastRecordedTop !== null && actualTop === lastRecordedTop) {
        continue;
      }
      lastRecordedTop = actualTop;
      const innerRect = stageInner.getBoundingClientRect();
      const visibleTop = Math.max(innerRect.top, scrollRect.top);
      const visibleBottom = Math.min(innerRect.bottom, scrollRect.bottom);

      frames.push({
        top: actualTop,
        dataUrl: await captureVisibleTab(),
        innerLeft: innerRect.left,
        innerWidth: innerRect.width,
        visibleTop,
        visibleBottom
      });
    }
  } finally {
    stageScroll.scrollTop = originalTop;
    stageInner.style.background = originalInnerStyle.background;
    stageInner.style.backdropFilter = originalInnerStyle.backdropFilter;
    stageInner.style.boxShadow = originalInnerStyle.boxShadow;
  }

  if (!frames.length) {
    throw new Error("未获取到可导出的截图帧");
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建画布上下文");
  }

  function paintStageBackground(bgStyle) {
    if (bgStyle === "night") {
      const base = context.createLinearGradient(0, 0, 0, outputHeight);
      base.addColorStop(0, "#0b1220");
      base.addColorStop(1, "#0b1220");
      context.fillStyle = base;
      context.fillRect(0, 0, outputWidth, outputHeight);
    } else if (bgStyle === "mesh") {
      const base = context.createLinearGradient(0, 0, 0, outputHeight);
      base.addColorStop(0, "#eaf6ff");
      base.addColorStop(1, "#eaf6ff");
      context.fillStyle = base;
      context.fillRect(0, 0, outputWidth, outputHeight);
    } else {
      context.fillStyle = "#f8fafc";
      context.fillRect(0, 0, outputWidth, outputHeight);
    }

    const r1 = context.createRadialGradient(
      Math.round(outputWidth * 0.2),
      Math.round(outputHeight * 0.2),
      10,
      Math.round(outputWidth * 0.2),
      Math.round(outputHeight * 0.2),
      Math.round(outputWidth * 0.5)
    );
    if (bgStyle === "night") {
      r1.addColorStop(0, "rgba(56,189,248,0.20)");
      r1.addColorStop(1, "rgba(56,189,248,0)");
    } else if (bgStyle === "mesh") {
      r1.addColorStop(0, "rgba(20,184,166,0.30)");
      r1.addColorStop(1, "rgba(20,184,166,0)");
    } else {
      r1.addColorStop(0, "rgba(14,116,144,0.10)");
      r1.addColorStop(1, "rgba(14,116,144,0)");
    }
    context.fillStyle = r1;
    context.fillRect(0, 0, outputWidth, outputHeight);

    const r2 = context.createRadialGradient(
      Math.round(outputWidth * 0.82),
      Math.round(outputHeight * 0.14),
      10,
      Math.round(outputWidth * 0.82),
      Math.round(outputHeight * 0.14),
      Math.round(outputWidth * 0.45)
    );
    if (bgStyle === "night") {
      r2.addColorStop(0, "rgba(99,102,241,0.18)");
      r2.addColorStop(1, "rgba(99,102,241,0)");
    } else if (bgStyle === "mesh") {
      r2.addColorStop(0, "rgba(14,165,233,0.30)");
      r2.addColorStop(1, "rgba(14,165,233,0)");
    } else {
      r2.addColorStop(0, "rgba(15,118,110,0.08)");
      r2.addColorStop(1, "rgba(15,118,110,0)");
    }
    context.fillStyle = r2;
    context.fillRect(0, 0, outputWidth, outputHeight);
  }

  const bgStyle = stageClassName.includes("bg-night")
    ? "night"
    : stageClassName.includes("bg-mesh")
      ? "mesh"
      : "paper";
  paintStageBackground(bgStyle);

  let headerDrawn = false;
  let maxPaintedBottom = outputHeaderHeight;
  const sourceX = Math.max(0, Math.floor(stageRect.left * dpr));
  const sourceHeaderY = Math.max(0, Math.floor(headerRect.top * dpr));

  for (const frame of frames) {
    const image = await loadImage(frame.dataUrl);
    const visibleHeight = frame.visibleBottom - frame.visibleTop;
    const sourceY = Math.max(0, Math.floor(frame.visibleTop * dpr));
    const sourceInnerX = Math.max(0, Math.floor(frame.innerLeft * dpr));
    const sourceInnerWidth = Math.max(1, Math.ceil(frame.innerWidth * dpr));
    const sourceHeight = Math.max(0, Math.ceil(visibleHeight * dpr));
    const innerOffsetY = frame.visibleTop - scrollRect.top;
    const destX = Math.max(0, Math.floor((frame.innerLeft - stageRect.left) * dpr));
    const destY = outputHeaderHeight + Math.max(0, Math.floor((frame.top + innerOffsetY) * dpr));
    const drawHeight = Math.min(sourceHeight, outputHeight - destY);

    if (!headerDrawn) {
      context.drawImage(
        image,
        sourceX,
        sourceHeaderY,
        outputWidth,
        outputHeaderHeight,
        0,
        0,
        outputWidth,
        outputHeaderHeight
      );
      headerDrawn = true;
    }

    if (drawHeight > 0 && sourceInnerWidth > 0) {
      context.drawImage(
        image,
        sourceInnerX,
        sourceY,
        sourceInnerWidth,
        drawHeight,
        destX,
        destY,
        sourceInnerWidth,
        drawHeight
      );
      const paintedBottom = destY + drawHeight;
      if (paintedBottom > maxPaintedBottom) {
        maxPaintedBottom = paintedBottom;
      }
    }
  }

  const finalHeight = Math.max(outputHeaderHeight + 1, Math.min(outputHeight, maxPaintedBottom));
  const finalCanvas = finalHeight === outputHeight ? canvas : (() => {
    const trimmed = document.createElement("canvas");
    trimmed.width = outputWidth;
    trimmed.height = finalHeight;
    const trimmedCtx = trimmed.getContext("2d");
    if (!trimmedCtx) {
      throw new Error("无法创建裁剪画布上下文");
    }
    trimmedCtx.drawImage(canvas, 0, 0, outputWidth, finalHeight, 0, 0, outputWidth, finalHeight);
    return trimmed;
  })();

  const blob = await new Promise((resolve, reject) => {
    finalCanvas.toBlob((result) => {
      if (!result) {
        reject(new Error("PNG 编码失败"));
        return;
      }
      resolve(result);
    }, "image/png");
  });

  const fileTitle = normalizeConversationTitle(state?.conversationTitle, data.title || "chat");
  downloadBlob(blob, `${fileTitle}-${EXPORT_BUILD_TAG}.png`);
}

function waitForPrintEnd(timeoutMs = 1200) {
  return new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      window.removeEventListener("afterprint", finish);
      resolve();
    };

    window.addEventListener("afterprint", finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

async function exportPreviewToPdf() {
  window.print();
  await waitForPrintEnd();
}

async function loadWorkbenchPayload(sid) {
  const row = await ext.storage.local.get(sid);
  const data = row?.[sid];
  if (!data) {
    throw new Error("导出数据已失效，请回到 AI 对话页面重新打开工作台");
  }

  await ext.storage.local.remove(sid);
  return {
    title: cleanText(data.title || "chat") || "chat",
    messages: Array.isArray(data.messages) ? data.messages : [],
    providerId: cleanText(data.providerId || "") || "unknown",
    providerName: cleanText(data.providerName || "") || "AI"
  };
}

async function loadStylePrefs(provider) {
  const row = await ext.storage.local.get("eac_style_prefs");
  const prefs = row?.eac_style_prefs || {};

  const chatStyle = CHAT_STYLE_OPTIONS.some((x) => x.id === prefs.chatStyle)
    ? prefs.chatStyle
    : CHAT_STYLE_OPTIONS[0].id;

  const bgStyle = BG_STYLE_OPTIONS.some((x) => x.id === prefs.bgStyle)
    ? prefs.bgStyle
    : BG_STYLE_OPTIONS[0].id;

  const assistantMode = ASSISTANT_MODE_OPTIONS.some((x) => x.id === prefs.assistantMode)
    ? prefs.assistantMode
    : ASSISTANT_MODE_OPTIONS[0].id;
  const providerId = cleanText(provider?.id || "") || "unknown";
  const providerName = normalizeRoleTitle(provider?.name, "Assistant");
  const assistantTitleMap = typeof prefs.assistantTitlesByProvider === "object" && prefs.assistantTitlesByProvider
    ? prefs.assistantTitlesByProvider
    : {};
  const assistantTitle = normalizeRoleTitle(assistantTitleMap[providerId], providerName);
  const userTitle = normalizeRoleTitle(prefs.userTitle, "User");

  return { chatStyle, bgStyle, assistantMode, assistantTitle, userTitle };
}

async function saveStylePrefs(state) {
  const row = await ext.storage.local.get("eac_style_prefs");
  const prev = row?.eac_style_prefs || {};
  const providerId = cleanText(state.providerId || "") || "unknown";
  const assistantTitlesByProvider = {
    ...(typeof prev.assistantTitlesByProvider === "object" && prev.assistantTitlesByProvider ? prev.assistantTitlesByProvider : {}),
    [providerId]: normalizeRoleTitle(state.assistantTitle, normalizeRoleTitle(state.providerName, "Assistant"))
  };

  await ext.storage.local.set({
    eac_style_prefs: {
      chatStyle: state.chatStyle,
      bgStyle: state.bgStyle,
      assistantMode: state.assistantMode,
      userTitle: normalizeRoleTitle(state.userTitle, "User"),
      assistantTitlesByProvider
    }
  });
}

async function startWorkbenchMode() {
  document.body.classList.add("workbench-mode");
  qs("popup-app").classList.add("hidden");
  const app = qs("workbench-app");
  app.classList.remove("hidden");

  const params = new URLSearchParams(location.search);
  const sid = params.get("sid");

  if (!sid) {
    app.innerHTML = "<div class='wb-panel'>缺少工作台数据，请回到 AI 对话页面重新打开。</div>";
    return;
  }

  try {
    await ensureMarkdownRuntime();
    await assertWorkbenchProAccess({ forceRefresh: true });

    const data = await loadWorkbenchPayload(sid);
    const prefs = await loadStylePrefs({
      id: data.providerId,
      name: data.providerName
    });

    if (!data.messages.length) {
      throw new Error("当前对话为空，无法导出");
    }

    const state = {
      ...prefs,
      providerId: data.providerId,
      providerName: data.providerName,
      conversationTitle: normalizeConversationTitle(data.title || "chat")
    };

    const rerender = () => {
      app.innerHTML = renderWorkbenchHtml(data, state);

      const chatBox = qs("chat-options");
      const bgBox = qs("bg-options");
      const assistantModeBox = qs("assistant-mode-options");
      fillStyleOptionButtons(chatBox, CHAT_STYLE_OPTIONS, state.chatStyle);
      fillStyleOptionButtons(bgBox, BG_STYLE_OPTIONS, state.bgStyle);
      fillStyleOptionButtons(assistantModeBox, ASSISTANT_MODE_OPTIONS, state.assistantMode);

      const conversationTitleInput = qs("conversation-title-input");
      conversationTitleInput?.addEventListener("change", () => {
        state.conversationTitle = normalizeConversationTitle(conversationTitleInput.value, "chat");
        rerender();
      });

      for (const btn of chatBox.querySelectorAll(".wb-option")) {
        btn.addEventListener("click", async () => {
          state.chatStyle = btn.dataset.id;
          await saveStylePrefs(state);
          rerender();
        });
      }

      for (const btn of bgBox.querySelectorAll(".wb-option")) {
        btn.addEventListener("click", async () => {
          state.bgStyle = btn.dataset.id;
          await saveStylePrefs(state);
          rerender();
        });
      }

      for (const btn of assistantModeBox.querySelectorAll(".wb-option")) {
        btn.addEventListener("click", async () => {
          state.assistantMode = btn.dataset.id;
          await saveStylePrefs(state);
          rerender();
        });
      }

      const assistantTitleInput = qs("assistant-title-input");
      const userTitleInput = qs("user-title-input");
      if (assistantTitleInput) {
        assistantTitleInput.disabled = state.assistantMode !== "title";
      }

      assistantTitleInput?.addEventListener("change", async () => {
        state.assistantTitle = normalizeRoleTitle(assistantTitleInput.value, normalizeRoleTitle(state.providerName, "Assistant"));
        await saveStylePrefs(state);
        rerender();
      });

      userTitleInput?.addEventListener("change", async () => {
        state.userTitle = normalizeRoleTitle(userTitleInput.value, "User");
        await saveStylePrefs(state);
        rerender();
      });

      app.querySelector("[data-action='close_tab']").addEventListener("click", async () => {
        const tab = await getActiveTab();
        await ext.tabs.remove(tab.id);
      });

      app.querySelector("[data-action='export_png']").addEventListener("click", async () => {
        setWorkbenchBusy(true);
        setWorkbenchStatus("正在导出 PNG...");
        try {
          await exportPreviewToPng(data, state);
          setWorkbenchStatus("PNG 导出成功");
        } catch (error) {
          setWorkbenchStatus(error?.message || String(error), true);
        } finally {
          setWorkbenchBusy(false);
        }
      });

      app.querySelector("[data-action='export_pdf']").addEventListener("click", async () => {
        setWorkbenchBusy(true);
        setWorkbenchStatus("正在准备 PDF...");
        try {
          await exportPreviewToPdf();
          setWorkbenchStatus("已打开打印面板，请存储为 PDF");
        } catch (error) {
          setWorkbenchStatus(error?.message || String(error), true);
        } finally {
          setWorkbenchBusy(false);
        }
      });
    };

    rerender();
  } catch (error) {
    app.innerHTML = `<div class='wb-panel' style='color:#b91c1c;'>${escapeHtml(error?.message || String(error))}</div>`;
  }
}

async function startPopupMode() {
  qs("workbench-app").classList.add("hidden");
  qs("popup-app").classList.remove("hidden");
  await applyWorkbenchProGuard({ forceRefresh: true });
  bindPopupActions();
}

const mode = new URLSearchParams(location.search).get("mode");
if (mode === "workbench") {
  startWorkbenchMode();
} else {
  startPopupMode();
}
