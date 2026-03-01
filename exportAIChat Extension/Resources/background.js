const ext = globalThis.browser ?? globalThis.chrome;

async function captureVisible(senderTab) {
  const windowId = senderTab?.windowId;
  const dataUrl = await new Promise((resolve, reject) => {
    try {
      const maybePromise = ext.tabs.captureVisibleTab(windowId, { format: "png" }, (url) => {
        const runtimeError = ext.runtime?.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(url);
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
  return { ok: true, dataUrl };
}

ext.runtime.onMessage.addListener((request, sender) => {
  if (request?.action !== "capture_visible_tab") {
    return undefined;
  }

  return captureVisible(sender?.tab)
    .catch((error) => ({ ok: false, error: error?.message || String(error) }));
});
