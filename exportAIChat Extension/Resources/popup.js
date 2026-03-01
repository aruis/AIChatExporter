const ext = globalThis.browser ?? globalThis.chrome;
const EXPORT_BUILD_TAG = "dbg-20260301-b";

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

function ensureChatgptUrl(url) {
  return Boolean(url && (url.includes("chatgpt.com") || url.includes("chat.openai.com")));
}

async function collectConversationFromActiveTab() {
  const tab = await getActiveTab();
  if (!ensureChatgptUrl(tab.url)) {
    throw new Error("请先切换到 ChatGPT 对话页面");
  }

  const response = await ext.tabs.sendMessage(tab.id, { action: "collect_conversation" });
  if (!response?.ok) {
    throw new Error(response?.error || "读取对话失败");
  }

  return {
    title: response.title || "chat",
    messages: response.messages || []
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
  if (!ensureChatgptUrl(tab.url)) {
    throw new Error("请先切换到 ChatGPT 对话页面");
  }

  const response = await ext.tabs.sendMessage(tab.id, { action: "export_markdown" });
  if (!response?.ok) {
    throw new Error(response?.error || "导出失败");
  }

  return response.message || "Markdown 导出成功";
}

async function openWorkbenchFromPopup() {
  const payload = await collectConversationFromActiveTab();
  if (!payload.messages.length) {
    throw new Error("对话为空，无法打开导出工作台");
  }

  const sid = `eac_workbench_${timestampKey()}`;
  await ext.storage.local.set({ [sid]: payload });

  const url = ext.runtime.getURL(`popup.html?mode=workbench&sid=${encodeURIComponent(sid)}`);
  await ext.tabs.create({ url });
  return "已打开导出工作台";
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
        const message = action === "export_markdown"
          ? await exportMarkdownFromPopup()
          : await openWorkbenchFromPopup();
        setPopupStatus(message);
      } catch (error) {
        setPopupStatus(error?.message || String(error), true);
      } finally {
        setPopupBusy(false);
      }
    });
  }
}

function parseCodeBlocks(text) {
  const escaped = escapeHtml(text);
  const blocks = [];
  const codeRegex = /```([\s\S]*?)```/g;
  let last = 0;
  let match;

  while ((match = codeRegex.exec(escaped)) !== null) {
    const plain = escaped.slice(last, match.index).trim();
    if (plain) {
      blocks.push(`<p>${plain.replaceAll("\n", "<br>")}</p>`);
    }

    const code = cleanText(match[1]);
    if (code) {
      blocks.push(`<pre><code>${code}</code></pre>`);
    }

    last = match.index + match[0].length;
  }

  const trailing = escaped.slice(last).trim();
  if (trailing) {
    blocks.push(`<p>${trailing.replaceAll("\n", "<br>")}</p>`);
  }

  if (!blocks.length) {
    return `<p>${escaped.replaceAll("\n", "<br>")}</p>`;
  }

  return blocks.join("");
}

function buildMessageListHtml(messages) {
  return messages.map((item) => {
    const role = item.role === "user" ? "user" : "assistant";
    const badge = role === "user" ? "User" : "Assistant";
    const body = parseCodeBlocks(item.text || "");

    return `
      <article class="eac-msg role-${role}">
        <div class="eac-badge">${badge}</div>
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
        <div class="wb-tag">${escapeHtml(data.title)} · ${EXPORT_BUILD_TAG}</div>
      </div>
      <button class="wb-back" data-action="close_tab">关闭</button>
    </header>

    <section class="wb-layout">
      <aside class="wb-panel">
        <h3 class="wb-group-title">对话框样式</h3>
        <div class="wb-option-row" id="chat-options"></div>

        <h3 class="wb-group-title">背景样式</h3>
        <div class="wb-option-row" id="bg-options"></div>

        <div class="wb-actions">
          <button class="wb-btn primary" data-action="export_png">导出 PNG</button>
          <button class="wb-btn" data-action="export_pdf">导出 PDF</button>
        </div>

        <div class="wb-status" id="wb-status"></div>
      </aside>

      <section class="wb-preview" id="wb-preview">
        <div class="eac-stage chat-${state.chatStyle} bg-${state.bgStyle}" id="wb-stage">
          <div class="eac-stage-header" id="wb-stage-header">
            <p class="eac-stage-title">${escapeHtml(data.title)}</p>
            <p class="eac-stage-sub">Export AI Chat · ${EXPORT_BUILD_TAG}</p>
          </div>
          <div class="eac-stage-scroll" id="wb-stage-scroll">
            <div class="eac-stage-inner">
              ${buildMessageListHtml(data.messages)}
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

function buildScrollPositions(totalHeight, viewportHeight) {
  if (totalHeight <= viewportHeight + 2) {
    return [0];
  }

  const overlap = 96;
  const step = Math.max(180, viewportHeight - overlap);
  const maxStart = Math.max(0, totalHeight - viewportHeight);
  const positions = [];

  for (let y = 0; y < maxStart; y += step) {
    positions.push(y);
  }
  positions.push(maxStart);

  return [...new Set(positions.map((value) => Math.max(0, Math.floor(value))))];
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

async function exportPreviewToPng(data) {
  const stage = qs("wb-stage");
  const stageHeader = qs("wb-stage-header");
  const stageScroll = qs("wb-stage-scroll");

  const stageRect = stage.getBoundingClientRect();
  const headerRect = stageHeader.getBoundingClientRect();
  const scrollRect = stageScroll.getBoundingClientRect();

  const viewportHeight = stageScroll.clientHeight;
  const totalHeight = stageScroll.scrollHeight;
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

  try {
    for (const top of positions) {
      stageScroll.scrollTop = top;
      await new Promise((resolve) => setTimeout(resolve, 220));
      frames.push({ top, dataUrl: await captureVisibleTab() });
    }
  } finally {
    stageScroll.scrollTop = originalTop;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建画布上下文");
  }

  let headerDrawn = false;
  const sourceX = Math.max(0, Math.round(stageRect.left * dpr));
  const sourceScrollY = Math.max(0, Math.round(scrollRect.top * dpr));
  const sourceHeaderY = Math.max(0, Math.round(headerRect.top * dpr));

  for (const frame of frames) {
    const image = await loadImage(frame.dataUrl);
    const sourceHeight = Math.max(1, Math.round(viewportHeight * dpr));
    const destY = outputHeaderHeight + Math.max(0, Math.round(frame.top * dpr));
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

    if (drawHeight > 0) {
      context.drawImage(
        image,
        sourceX,
        sourceScrollY,
        outputWidth,
        drawHeight,
        0,
        destY,
        outputWidth,
        drawHeight
      );
    }
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("PNG 编码失败"));
        return;
      }
      resolve(result);
    }, "image/png");
  });

  downloadBlob(blob, `${data.title}-${EXPORT_BUILD_TAG}.png`);
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
    throw new Error("导出数据已失效，请回到 ChatGPT 页面重新打开工作台");
  }

  await ext.storage.local.remove(sid);
  return {
    title: cleanText(data.title || "chat") || "chat",
    messages: Array.isArray(data.messages) ? data.messages : []
  };
}

async function loadStylePrefs() {
  const row = await ext.storage.local.get("eac_style_prefs");
  const prefs = row?.eac_style_prefs || {};

  const chatStyle = CHAT_STYLE_OPTIONS.some((x) => x.id === prefs.chatStyle)
    ? prefs.chatStyle
    : CHAT_STYLE_OPTIONS[0].id;

  const bgStyle = BG_STYLE_OPTIONS.some((x) => x.id === prefs.bgStyle)
    ? prefs.bgStyle
    : BG_STYLE_OPTIONS[0].id;

  return { chatStyle, bgStyle };
}

async function saveStylePrefs(state) {
  await ext.storage.local.set({
    eac_style_prefs: {
      chatStyle: state.chatStyle,
      bgStyle: state.bgStyle
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
    app.innerHTML = "<div class='wb-panel'>缺少工作台数据，请回到 ChatGPT 页面重新打开。</div>";
    return;
  }

  try {
    const [data, prefs] = await Promise.all([
      loadWorkbenchPayload(sid),
      loadStylePrefs()
    ]);

    if (!data.messages.length) {
      throw new Error("当前对话为空，无法导出");
    }

    const state = { ...prefs };

    const rerender = () => {
      app.innerHTML = renderWorkbenchHtml(data, state);

      const chatBox = qs("chat-options");
      const bgBox = qs("bg-options");
      fillStyleOptionButtons(chatBox, CHAT_STYLE_OPTIONS, state.chatStyle);
      fillStyleOptionButtons(bgBox, BG_STYLE_OPTIONS, state.bgStyle);

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

      app.querySelector("[data-action='close_tab']").addEventListener("click", async () => {
        const tab = await getActiveTab();
        await ext.tabs.remove(tab.id);
      });

      app.querySelector("[data-action='export_png']").addEventListener("click", async () => {
        setWorkbenchBusy(true);
        setWorkbenchStatus("正在导出 PNG...");
        try {
          await exportPreviewToPng(data);
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

function startPopupMode() {
  qs("workbench-app").classList.add("hidden");
  qs("popup-app").classList.remove("hidden");
  bindPopupActions();
}

const mode = new URLSearchParams(location.search).get("mode");
if (mode === "workbench") {
  startWorkbenchMode();
} else {
  startPopupMode();
}
