const pendingNativeCalls = new Map();
const nativeCallTimeoutMs = 45_000;

let requestSeq = 0;
let currentProStatus = null;

function show(enabled, useSettingsInsteadOfPreferences) {
    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('state-on')[0].innerText = "AI Chat Exporter’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-off')[0].innerText = "AI Chat Exporter’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-unknown')[0].innerText = "You can turn on AI Chat Exporter’s extension in the Extensions section of Safari Settings.";
        document.getElementsByClassName('open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle('state-on', enabled);
        document.body.classList.toggle('state-off', !enabled);
    } else {
        document.body.classList.remove('state-on');
        document.body.classList.remove('state-off');
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage('open-preferences');
}

function setStatusText(text, isError = false) {
    const node = document.querySelector('.pro-status');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('is-error', Boolean(isError));
}

function setProductText(text) {
    const node = document.querySelector('.pro-product-text');
    if (!node) return;
    node.textContent = text;
}

function setActionButtonsDisabled(disabled) {
    document.querySelectorAll('.premium-actions button').forEach((button) => {
        button.disabled = Boolean(disabled);
    });
}

function setProStatus(isPro) {
    currentProStatus = Boolean(isPro);
    if (currentProStatus) {
        setStatusText('Pro 已解锁，可在扩展中使用自定义导出样式。');
    } else {
        setStatusText('当前未解锁 Pro。完成内购后将自动生效。');
    }
}

function nextRequestId() {
    requestSeq += 1;
    return `native-${Date.now()}-${requestSeq}`;
}

function callNative(action, payload = {}) {
    if (!webkit?.messageHandlers?.controller) {
        return Promise.reject(new Error('Native bridge is unavailable.'));
    }

    const id = nextRequestId();

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingNativeCalls.delete(id);
            reject(new Error('Native request timed out.'));
        }, nativeCallTimeoutMs);

        pendingNativeCalls.set(id, { resolve, reject, timeout });
        webkit.messageHandlers.controller.postMessage({ id, action, payload });
    });
}

window.__onNativeResponse = function onNativeResponse(id, response) {
    const pending = pendingNativeCalls.get(id);
    if (!pending) {
        return;
    }

    clearTimeout(pending.timeout);
    pendingNativeCalls.delete(id);

    if (response?.ok === false) {
        pending.reject(new Error(response.error || 'Request failed'));
        return;
    }

    pending.resolve(response || {});
};

window.__onNativeEvent = function onNativeEvent(eventName, payload) {
    if (eventName === 'proStatus' && typeof payload?.isPro === 'boolean') {
        setProStatus(payload.isPro);
        return;
    }

    if (eventName === 'productSummary') {
        if (payload?.displayPrice) {
            setProductText(`net.ximatai.aichatexporter.pro (${payload.displayPrice})`);
        }
        if (payload?.error) {
            setStatusText(payload.error, true);
        }
    }
};

async function refreshProStatus(forceRefresh = false) {
    const response = await callNative('get_pro_status', { forceRefresh });
    setProStatus(Boolean(response?.isPro));
}

async function loadProductSummary() {
    const response = await callNative('get_product_summary');
    const title = response?.displayName ? `${response.displayName}` : 'net.ximatai.aichatexporter.pro';
    const suffix = response?.displayPrice ? ` (${response.displayPrice})` : '';
    setProductText(`${title}${suffix}`);
}

async function buyPro() {
    setActionButtonsDisabled(true);
    setStatusText('正在发起购买…');
    try {
        const response = await callNative('purchase_pro');
        setProStatus(Boolean(response?.isPro));
    } catch (error) {
        setStatusText(error?.message || '购买失败，请稍后重试。', true);
    } finally {
        setActionButtonsDisabled(false);
    }
}

async function restorePurchases() {
    setActionButtonsDisabled(true);
    setStatusText('正在恢复购买…');
    try {
        const response = await callNative('restore_pro');
        setProStatus(Boolean(response?.isPro));
    } catch (error) {
        setStatusText(error?.message || '恢复购买失败，请稍后重试。', true);
    } finally {
        setActionButtonsDisabled(false);
    }
}

async function bootstrapPremium() {
    try {
        await refreshProStatus(true);
    } catch (error) {
        setStatusText(error?.message || '读取 Pro 状态失败。', true);
    }

    try {
        await loadProductSummary();
    } catch {
        setProductText('net.ximatai.aichatexporter.pro');
    }
}

document.querySelector('button.open-preferences').addEventListener('click', openPreferences);
document.querySelector('button.buy-pro').addEventListener('click', buyPro);
document.querySelector('button.restore-pro').addEventListener('click', restorePurchases);
document.querySelector('button.refresh-pro').addEventListener('click', () => {
    refreshProStatus(true).catch((error) => {
        setStatusText(error?.message || '刷新状态失败。', true);
    });
});

bootstrapPremium();
