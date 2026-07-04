const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');
const root = document.querySelector('#project-root');
const title = document.querySelector('#project-title');

if (!projectId) {
  root.innerHTML = '<p class="status-line" data-type="error">缺少项目 ID。</p>';
} else {
  loadProject(projectId);
}

async function loadProject(id) {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '项目读取失败');
    render(payload.project);
  } catch (error) {
    root.innerHTML = `<p class="status-line" data-type="error">${escapeHtml(error.message)}</p>`;
  }
}

function render(project) {
  title.textContent = project.project_id;
  const status = project.status;
  const product = project.product;
  root.innerHTML = `
    <section class="summary-grid">
      ${metric('Parent SKU', product.parent_sku)}
      ${metric('产品名称', product.product_name)}
      ${metric('SKU 总数', status.total_skus)}
      ${metric('下载成功', status.downloaded_images)}
      ${metric('下载失败', status.failed_images)}
      ${metric('项目路径', project.project_path)}
    </section>

    <section>
      <div class="section-head"><h2>SKU 列表</h2><span class="pill">${project.skus.length} rows</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>SKU</th><th>变种选项</th><th>图片预览</th><th>下载状态</th><th>本地路径</th></tr></thead>
          <tbody>
            ${project.skus.map((sku) => skuRow(project.project_id, sku)).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head"><h2>图片下载结果</h2><span class="pill">${project.report.download_results.length} files</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>类型</th><th>SKU</th><th>状态</th><th>URL</th><th>错误</th></tr></thead>
          <tbody>${project.report.download_results.map(downloadRow).join('')}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head"><h2>提示词文件</h2></div>
      <div class="prompt-list">${project.prompts.map((file) => `<span>${escapeHtml(file)}</span>`).join('')}</div>
    </section>
  `;
}

function metric(label, value) {
  return `<div class="metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? '')}</strong></div>`;
}

function skuRow(projectId, sku) {
  const image = sku.local_image_path
    ? `<img src="/projects-assets/${encodeURIComponent(projectId)}/${sku.local_image_path.split('/').map(encodeURIComponent).join('/')}" alt="" />`
    : '<span class="muted">无</span>';
  return `<tr>
    <td>${escapeHtml(sku.sku)}</td>
    <td>${escapeHtml(sku.variation_option)}</td>
    <td class="preview">${image}</td>
    <td><span class="pill">${escapeHtml(sku.download_status)}</span></td>
    <td>${escapeHtml(sku.local_image_path)}</td>
  </tr>`;
}

function downloadRow(item) {
  return `<tr>
    <td>${escapeHtml(item.type)}</td>
    <td>${escapeHtml(item.sku || '')}</td>
    <td><span class="pill">${escapeHtml(item.status)}</span></td>
    <td class="url-cell">${escapeHtml(item.url)}</td>
    <td>${escapeHtml(item.error || '')}</td>
  </tr>`;
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
