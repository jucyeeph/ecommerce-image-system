const promptRoot = document.querySelector('#prompt-settings');
const assetRoot = document.querySelector('#asset-settings');
const statusLine = document.querySelector('#settings-status');
const promptLabels = {
  angle_reference: '产品角度参考图',
  ecommerce_image_01: '电商图 01',
  ecommerce_image_02: '电商图 02',
  ecommerce_image_03: '电商图 03',
  ecommerce_image_04: '电商图 04',
  ecommerce_image_05: '电商图 05',
  ecommerce_image_06: '电商图 06',
  ecommerce_image_07: '电商图 07',
  ecommerce_image_08: '电商图 08',
  ecommerce_image_09: '电商图 09',
  sku_image: 'SKU 图'
};
const assetLabels = {
  logo: 'Logo',
  brand_refs: '品牌参考',
  background_refs: '背景参考',
  style_refs: '风格参考'
};

let settings = await loadSettings();
render();

document.querySelector('#save-prompts').addEventListener('click', savePrompts);

async function loadSettings() {
  const response = await fetch('/api/settings');
  return response.json();
}

function render() {
  promptRoot.innerHTML = Object.entries(promptLabels).map(([key, label]) => `
    <label class="prompt-editor">
      <span>${escapeHtml(label)}</span>
      <textarea data-prompt-key="${escapeHtml(key)}">${escapeHtml(settings.defaultPrompts[key] || '')}</textarea>
    </label>
  `).join('');

  assetRoot.innerHTML = Object.entries(assetLabels).map(([category, label]) => {
    const files = settings.generationAssets[category] || [];
    return `<div class="asset-box" data-category="${escapeHtml(category)}">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <small>${files.length} files</small>
      </div>
      <input type="file" />
      <div class="asset-list">${files.map((file) => `<span>${escapeHtml(file.name)}</span>`).join('')}</div>
    </div>`;
  }).join('');

  for (const input of assetRoot.querySelectorAll('input[type="file"]')) {
    input.addEventListener('change', uploadAsset);
  }
}

async function savePrompts() {
  const defaultPrompts = {};
  for (const textarea of promptRoot.querySelectorAll('textarea')) {
    defaultPrompts[textarea.dataset.promptKey] = textarea.value;
  }
  const response = await fetch('/api/settings/prompts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defaultPrompts })
  });
  settings = await response.json();
  setStatus(response.ok ? '已保存默认提示词。' : settings.error, response.ok ? 'working' : 'error');
}

async function uploadAsset(event) {
  const file = event.target.files[0];
  if (!file) return;
  const category = event.target.closest('.asset-box').dataset.category;
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`/api/settings/assets/${encodeURIComponent(category)}`, {
    method: 'POST',
    body
  });
  settings = await response.json();
  render();
  setStatus(response.ok ? '素材已上传。' : settings.error, response.ok ? 'working' : 'error');
}

function setStatus(message, type) {
  statusLine.textContent = message || '';
  statusLine.dataset.type = type || '';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
