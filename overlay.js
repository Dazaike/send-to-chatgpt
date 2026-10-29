// Injected on demand by background.js: shows the captured screenshot frozen over the page and
// lets the user lasso (free-draw) the region to send. Outside the lasso is filled white.
(() => {
  if (window.__sendToChatGPTCrop) return;
  window.__sendToChatGPTCrop = true;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'startCrop') start(msg.dataUrl, msg.mode);
  });

  function dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(',');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) });
  }

  async function start(dataUrl, mode) {
    // createImageBitmap instead of <img src=data:...> so the page's CSP can't block it
    const bmp = await createImageBitmap(dataUrlToBlob(dataUrl));
    const k = bmp.width / window.innerWidth; // image pixels per CSS pixel

    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;margin:0;padding:0';
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    const hint = document.createElement('div');
    hint.textContent = 'Draw around the area to send to ChatGPT \u00b7 Esc to cancel';
    hint.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:6px 12px;' +
      'background:#10231d;color:#fff;font:14px/1.3 system-ui,sans-serif;border-radius:6px;pointer-events:none';
    box.append(canvas, hint);
    document.documentElement.appendChild(box);

    const ctx = canvas.getContext('2d');
    let pts = [];
    let drawing = false;

    const pathOf = (dx = 0, dy = 0) => {
      const p = new Path2D();
      pts.forEach((q, i) => (i ? p.lineTo(q.x - dx, q.y - dy) : p.moveTo(q.x - dx, q.y - dy)));
      p.closePath();
      return p;
    };

    function draw() {
      ctx.drawImage(bmp, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (pts.length < 2) return;
      const p = pathOf();
      ctx.save();
      ctx.clip(p);
      ctx.drawImage(bmp, 0, 0);
      ctx.restore();
      ctx.lineWidth = 2 * k;
      ctx.strokeStyle = '#10a37f';
      ctx.setLineDash([8 * k, 5 * k]);
      ctx.stroke(p);
    }

    function cleanup() {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', cleanup);
      box.remove();
      bmp.close();
    }

    function toast(text) {
      const t = document.createElement('div');
      t.textContent = text;
      t.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
        'padding:6px 12px;background:#a63a4c;color:#fff;font:14px/1.3 system-ui,sans-serif;border-radius:6px';
      document.documentElement.appendChild(t);
      setTimeout(() => t.remove(), 6000);
    }

    function finish() {
      drawing = false;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys)));
      const x1 = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
      const y1 = Math.min(canvas.height, Math.ceil(Math.max(...ys)));
      if (pts.length < 3 || x1 - x0 < 8 * k || y1 - y0 < 8 * k) return cleanup();
      const out = document.createElement('canvas');
      out.width = x1 - x0;
      out.height = y1 - y0;
      const o = out.getContext('2d');
      o.fillStyle = '#fff';
      o.fillRect(0, 0, out.width, out.height);
      o.clip(pathOf(x0, y0));
      o.drawImage(bmp, -x0, -y0);
      let result;
      try {
        result = out.toDataURL('image/jpeg', 0.92);
      } catch (e) {
        cleanup();
        return toast('Send to ChatGPT: could not encode crop (' + e.message + ')');
      }
      cleanup();
      chrome.runtime.sendMessage({ type: 'cropDone', dataUrl: result, mode }).then(
        () => {},
        (e) => toast('Send to ChatGPT: could not reach extension (' + e.message + ')')
      );
    }

    const pos = (e) => ({ x: e.clientX * k, y: e.clientY * k });
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      pts = [pos(e)];
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      pts.push(pos(e));
      draw();
    });
    canvas.addEventListener('pointerup', () => drawing && finish());
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', cleanup);
    draw();
  }
})();
