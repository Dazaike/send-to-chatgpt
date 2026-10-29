const DEFAULTS = { mode: 'tab', width: 520, height: 720 };
const CHATGPT_URL = 'https://chatgpt.com/';
const MAX_BYTES = 2 * 1024 * 1024; // keep the pending payload well inside the 10 MB storage.session quota
const MAX_SIDE = 2560;

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Several top-level items from one extension are grouped by Chrome under the extension name.
    const items = [
      { id: 'text-tab', title: 'Send text to ChatGPT in a new tab', contexts: ['selection'] },
      { id: 'text-window', title: 'Send text to ChatGPT in a new window', contexts: ['selection'] },
      { id: 'image-tab', title: 'Send image to ChatGPT in a new tab', contexts: ['image'] },
      { id: 'image-window', title: 'Send image to ChatGPT in a new window', contexts: ['image'] },
      { id: 'shot-tab', title: 'Screenshot to ChatGPT in a new tab', contexts: ['page'] },
      { id: 'shot-window', title: 'Screenshot to ChatGPT in a new window', contexts: ['page'] }
    ];
    for (const i of items) chrome.contextMenus.create(i);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const [kind, mode] = String(info.menuItemId).split('-');
  if (kind === 'text') {
    const text = info.selectionText && info.selectionText.trim();
    if (text) openChatGPT({ text }, { mode });
  } else if (kind === 'image') {
    sendImageUrl(info.srcUrl, mode).catch((e) => console.warn('Send image failed:', e));
  } else if (kind === 'shot' && tab) {
    startScreenshot(tab, mode).catch((e) => console.warn('Screenshot failed:', e));
  }
});

chrome.omnibox.setDefaultSuggestion({ description: 'Send to ChatGPT: <match>%s</match>' });
chrome.omnibox.onInputEntered.addListener((text) => {
  if (text.trim()) openChatGPT({ text }, { useCursor: false });
});

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) });
}

async function toDataUrl(blob) {
  if (blob.size > MAX_BYTES) {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function sendImageUrl(url, mode) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  await openChatGPT({ image: await toDataUrl(await res.blob()) }, { mode });
}

async function startScreenshot(tab, mode) {
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['overlay.js'] });
  await chrome.tabs.sendMessage(tab.id, { type: 'startCrop', dataUrl, mode });
}

// payload: { text?, image? (data URL) }; mode omitted -> saved setting (address bar)
async function openChatGPT(payload, { mode, useCursor = true } = {}) {
  const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  let tab;
  if ((mode || s.mode) === 'window') {
    const opts = { url: CHATGPT_URL, type: 'popup', width: s.width, height: s.height };
    let pos = null;
    if (useCursor) {
      const { lastCursor: c } = await chrome.storage.session.get('lastCursor');
      if (c) {
        pos = {
          left: Math.round(clamp(c.x + 10, c.availLeft, c.availLeft + c.availWidth - s.width)),
          top: Math.round(clamp(c.y + 10, c.availTop, c.availTop + c.availHeight - s.height))
        };
        Object.assign(opts, pos);
      }
    }
    const win = await chrome.windows.create(opts);
    if (pos) await chrome.windows.update(win.id, pos);
    tab = win.tabs[0];
  } else {
    tab = await chrome.tabs.create({ url: CHATGPT_URL });
  }
  await chrome.storage.session.set({ ['pending_' + tab.id]: payload });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'cursor') {
    chrome.storage.session.set({ lastCursor: msg });
    return false;
  }
  if (msg.type === 'cropDone') {
    toDataUrl(dataUrlToBlob(msg.dataUrl))
      .then((image) => openChatGPT({ image }, { mode: msg.mode }))
      .catch((e) => console.warn('Send crop failed:', e));
    return false;
  }
  if (msg.type === 'getPending' && sender.tab) {
    const key = 'pending_' + sender.tab.id;
    chrome.storage.session.get(key).then((r) => sendResponse(r[key] || {}));
    return true;
  }
  if (msg.type === 'clearPending' && sender.tab) {
    chrome.storage.session.remove('pending_' + sender.tab.id);
    return false;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove('pending_' + tabId);
});
