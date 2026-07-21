const form = document.querySelector('#import-form');
const fileInput = document.querySelector('#file-input');
const statusLine = document.querySelector('#import-status');
const list = document.querySelector('#project-list');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    setStatus('请选择一个 .xlsx 文件。', 'error');
    return;
  }
  const body = new FormData();
  body.append('file', file);
  setStatus('正在导入并下载图片...', 'working');
  form.querySelector('button').disabled = true;
  try {
    const response = await fetch('/api/import', { method: 'POST', body });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '导入失败');
    window.location.href = `/project.html?id=${encodeURIComponent(payload.project.projectId)}`;
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    form.querySelector('button').disabled = false;
  }
});

document.querySelector('#refresh-projects').addEventListener('click', loadProjects);
loadProjects();

async function loadProjects() {
  const response = await fetch('/api/projects');
  const payload = await response.json();
  list.innerHTML = '';
  if (!payload.projects?.length) {
    list.innerHTML = '<p class="muted">暂无项目。</p>';
    return;
  }
  for (const project of payload.projects) {
    const item = document.createElement('a');
    item.className = 'project-row';
    item.href = `/project.html?id=${encodeURIComponent(project.project_id)}`;
    item.innerHTML = `
      <span>
        <strong>${escapeHtml(project.project_name)}</strong>
        <small>${escapeHtml(project.product_name || '')}</small>
      </span>
      <span class="pill">${Number(project.total_skus || 0)} SKU</span>
    `;
    list.appendChild(item);
  }
}

function setStatus(message, type) {
  statusLine.textContent = message;
  statusLine.dataset.type = type;
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
