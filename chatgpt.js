const BOX_SELECTORS = [
  '#prompt-textarea',
  'div.ProseMirror[contenteditable="true"]',
  'textarea[name="prompt-textarea"]'
];

function findBox() {
  for (const sel of BOX_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

const SEND_ANY = 'button[data-testid="send-button"], button[aria-label="Send"], button[aria-label="Send prompt"]';
const SEND_SELECTOR = SEND_ANY.split(', ').map((s) => s + ':not([disabled])').join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const boxText = (box) => (box.value !== undefined ? box.value : box.textContent) || '';

// Decoded by hand: fetch(data:) can be blocked by the page's CSP.
function dataUrlToFile(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const type = head.slice(5, head.indexOf(';'));
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], 'image.' + (type.split('/')[1] || 'png').replace('jpeg', 'jpg'), { type });
}

// The composer exists in the server-rendered HTML before ChatGPT's handlers are attached, so an
// early paste is silently ignored. Paste, check that an attachment actually appeared, and retry
// (alternating with the hidden file input) until it does.
async function attachImage(image) {
  const file = dataUrlToFile(image);
  await sleep(300);
  for (let attempt = 1; attempt <= 6; attempt++) {
    const box = findBox(); // re-query: the element can be replaced during hydration
    if (!box) { await sleep(300); continue; }
    const form = box.closest('form');
    const imgsBefore = form ? form.querySelectorAll('img').length : 0;
    const dt = new DataTransfer();
    dt.items.add(file);
    if (attempt % 2 === 1) {
      box.focus();
      box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } else {
      const input = document.querySelector('input[type="file"]');
      if (!input) continue;
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Poll instead of a fixed wait so a fast attach doesn't sit idle.
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      await sleep(100);
      if (document.querySelector(SEND_ANY) || (form && form.querySelectorAll('img').length > imgsBefore)) {
        return true;
      }
    }
  }
  return false;
}

async function run(box, { text, image }) {
  box.focus();
  document.execCommand('selectAll', false); // replace any saved draft
  if (text) {
    document.execCommand('insertText', false, text);
    if (!boxText(box).trim()) {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }
  } else {
    document.execCommand('delete', false);
  }
  if (image && !(await attachImage(image))) {
    console.warn('Send to ChatGPT: could not attach the image');
    return;
  }
  // With an image the send button stays disabled while it uploads, so wait longer before the
  // Enter fallback.
  const start = Date.now();
  const giveUpAfter = image ? 30000 : 5000;
  const timer = setInterval(() => {
    const btn = document.querySelector(SEND_SELECTOR);
    if (btn) {
      clearInterval(timer);
      btn.click();
      chrome.runtime.sendMessage({ type: 'clearPending' });
    } else if (Date.now() - start > giveUpAfter) {
      clearInterval(timer);
      const ev = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      (findBox() || box).dispatchEvent(new KeyboardEvent('keydown', ev));
      chrome.runtime.sendMessage({ type: 'clearPending' });
    }
  }, 50);
}

// The pending entry is kept until the message is actually sent, so a page reload or a read that
// races the background script's write doesn't lose it.
function fetchPending(box, tries = 0) {
  chrome.runtime.sendMessage({ type: 'getPending' }, (r) => {
    if (r && (r.text || r.image)) {
      run(box, r).catch((e) => console.warn('Send to ChatGPT failed:', e));
    } else if (tries < 40) {
      setTimeout(() => fetchPending(box, tries + 1), 250);
    }
  });
}

const waitStart = Date.now();
const waitTimer = setInterval(() => {
  const box = findBox();
  if (box) {
    clearInterval(waitTimer);
    fetchPending(box);
  } else if (Date.now() - waitStart > 30000) {
    clearInterval(waitTimer);
  }
}, 50);
