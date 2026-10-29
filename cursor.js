window.addEventListener('contextmenu', (e) => {
  try {
    chrome.runtime.sendMessage({
      type: 'cursor',
      x: e.screenX,
      y: e.screenY,
      availLeft: screen.availLeft,
      availTop: screen.availTop,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight
    });
  } catch (_) {
    // extension reloaded; context invalidated
  }
}, true);
