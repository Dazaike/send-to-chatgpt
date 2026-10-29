const size = (v) => { const n = Number(v); return Number.isNaN(n) || n < 300 ? 300 : n; };

document.addEventListener('DOMContentLoaded', async () => {
  const s = await chrome.storage.sync.get({ mode: 'tab', width: 520, height: 720 });
  document.querySelector(`input[name="mode"][value="${s.mode}"]`).checked = true;
  document.getElementById('width').value = s.width;
  document.getElementById('height').value = s.height;
});

function save() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  chrome.storage.sync.set({
    mode,
    width: size(document.getElementById('width').value),
    height: size(document.getElementById('height').value)
  }).then(() => {
    const st = document.getElementById('status');
    st.textContent = 'Saved';
    setTimeout(() => { st.textContent = ''; }, 1000);
  });
}

document.addEventListener('change', save);
document.addEventListener('input', save);
