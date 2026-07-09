const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');
const root = document.querySelector('#project-root');
const title = document.querySelector('#project-title');
let currentProject = null;
let currentWorkflow = null;
let activeTaskKey = 'angle:angle_reference';

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
  currentProject = project;
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

    <section id="workflow-section">
      <div class="section-head">
        <h2>Phase 2 工作流</h2>
        <button id="refresh-workflow" type="button">刷新工作流</button>
      </div>
      <div id="workflow-root" class="workflow-root">
        <p class="muted">正在载入图片项目管理器...</p>
      </div>
    </section>
  `;
  loadWorkflow(project.project_id);
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

async function loadWorkflow(projectId) {
  const workflowRoot = document.querySelector('#workflow-root');
  document.querySelector('#refresh-workflow')?.addEventListener('click', () => loadWorkflow(projectId));
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflow`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '工作流载入失败');
    currentWorkflow = payload.workflow;
    workflowRoot.innerHTML = renderWorkflow(projectId, currentWorkflow);
    bindWorkflowActions(projectId);
  } catch (error) {
    workflowRoot.innerHTML = `<p class="status-line" data-type="error">${escapeHtml(error.message)}</p>`;
  }
}

function renderWorkflow(projectId, workflow) {
  const groups = workflowGroups(workflow);
  const activeTask = allWorkflowTasks(workflow).find((task) => taskKey(task) === activeTaskKey) || workflow.angleReference;
  activeTaskKey = taskKey(activeTask);
  return `
    <div class="workflow-workspace">
      <aside class="workflow-steps">
        ${groups.map((group) => workflowStepGroup(group)).join('')}
      </aside>
      <section class="active-task-panel">
        ${taskPanel(projectId, activeTask)}
      </section>
      <aside class="reference-rail">
        ${referenceRail(projectId, workflow)}
      </aside>
    </div>
  `;
}

function workflowGroups(workflow) {
  return [
    { title: '1. 产品角度参考图', tasks: [workflow.angleReference] },
    { title: '2. 9 张电商图', tasks: workflow.ecommerceImages },
    { title: '3. SKU 图', tasks: workflow.skuImages }
  ];
}

function workflowStepGroup(group) {
  return `<div class="workflow-step-group">
    <h3>${escapeHtml(group.title)}</h3>
    <div class="workflow-step-list">
      ${group.tasks.map((task) => `
        <button type="button" class="workflow-step ${taskKey(task) === activeTaskKey ? 'active' : ''}" data-task-key="${escapeHtml(taskKey(task))}">
          <span>${escapeHtml(task.title)}</span>
          <small>${escapeHtml(task.status)}</small>
        </button>
      `).join('')}
    </div>
  </div>`;
}

function taskPanel(projectId, task) {
  return `<article class="task-card" data-task-type="${escapeHtml(task.taskType)}" data-task-id="${escapeHtml(task.taskId)}">
    <div class="active-task-header">
      <div>
        <p class="eyebrow">当前任务</p>
        <h3>${escapeHtml(task.title)}</h3>
        <small>${escapeHtml(task.taskId)}</small>
      </div>
      <span class="pill">${escapeHtml(task.status)}</span>
    </div>
    <div class="active-task-body">
      <div class="task-source-preview">
        ${task.sku?.local_image_path ? `<img src="/projects-assets/${encodeURIComponent(projectId)}/${task.sku.local_image_path.split('/').map(encodeURIComponent).join('/')}" alt="" />` : `<div class="source-placeholder">使用 main/detail 和生图素材</div>`}
      </div>
      <label class="task-prompt-wrap">
        <span>提示词</span>
        <textarea class="task-prompt">${escapeHtml(task.prompt || '')}</textarea>
      </label>
    </div>
    <div class="task-actions">
      <button type="button" data-action="save-prompt">保存提示词</button>
      <button type="button" data-action="download-package">下载 ChatGPT 素材包</button>
      <label class="upload-button">
        上传生成结果
        <input type="file" accept="image/*" data-action="upload-result" />
      </label>
    </div>
    <div class="uploaded-list">
      ${(task.uploadedResults || []).map((file) => `<img src="/projects-assets/${encodeURIComponent(projectId)}/${file.path.split('/').map(encodeURIComponent).join('/')}" alt="${escapeHtml(file.name)}" />`).join('')}
    </div>
    <p class="task-message"></p>
  </article>`;
}

function bindWorkflowActions(projectId) {
  for (const step of document.querySelectorAll('.workflow-step')) {
    step.addEventListener('click', () => {
      activeTaskKey = step.dataset.taskKey;
      document.querySelector('#workflow-root').innerHTML = renderWorkflow(projectId, currentWorkflow);
      bindWorkflowActions(projectId);
    });
  }
  for (const card of document.querySelectorAll('.task-card')) {
    card.querySelector('[data-action="save-prompt"]').addEventListener('click', () => savePrompt(projectId, card));
    card.querySelector('[data-action="download-package"]').addEventListener('click', () => downloadPackage(projectId, card));
    card.querySelector('[data-action="upload-result"]').addEventListener('change', (event) => uploadResult(projectId, card, event));
  }
}

async function savePrompt(projectId, card) {
  const payload = { prompt: card.querySelector('.task-prompt').value };
  const response = await fetch(taskUrl(projectId, card, 'prompt'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  setTaskMessage(card, response.ok ? '提示词已保存。' : result.error, response.ok ? 'working' : 'error');
}

function downloadPackage(projectId, card) {
  window.location.href = taskUrl(projectId, card, 'package');
}

async function uploadResult(projectId, card, event) {
  const file = event.target.files[0];
  if (!file) return;
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(taskUrl(projectId, card, 'upload'), {
    method: 'POST',
    body
  });
  const result = await response.json();
  if (!response.ok) {
    setTaskMessage(card, result.error, 'error');
    return;
  }
  setTaskMessage(card, '结果已上传。', 'working');
  await loadWorkflow(projectId);
}

function taskUrl(projectId, card, action) {
  const taskType = card.dataset.taskType;
  const taskId = card.dataset.taskId;
  return `/api/projects/${encodeURIComponent(projectId)}/workflow/tasks/${encodeURIComponent(taskType)}/${encodeURIComponent(taskId)}/${action}`;
}

function setTaskMessage(card, message, type) {
  const target = card.querySelector('.task-message');
  target.textContent = message || '';
  target.dataset.type = type || '';
}

function referenceRail(projectId, workflow) {
  const sourceImages = (currentProject?.report?.download_results || [])
    .filter((item) => item.status === 'success' && ['main', 'detail'].includes(item.type) && item.local_path)
    .slice(0, 12);
  const angleImages = workflow.angleReference.uploadedResults || [];
  const styleImages = workflow.ecommerceImages.flatMap((task) => task.uploadedResults || []).slice(0, 12);
  return `
    <h3>参考素材</h3>
    ${referenceGroup(projectId, '原图素材', sourceImages.map((item) => ({ name: item.type, path: item.local_path })))}
    ${referenceGroup(projectId, '角度参考图', angleImages)}
    ${referenceGroup(projectId, '风格参考图', styleImages)}
  `;
}

function referenceGroup(projectId, title, files) {
  return `<div class="reference-group">
    <h4>${escapeHtml(title)}</h4>
    <div class="reference-thumbs">
      ${files.length ? files.map((file) => `<img src="/projects-assets/${encodeURIComponent(projectId)}/${file.path.split('/').map(encodeURIComponent).join('/')}" alt="${escapeHtml(file.name || '')}" />`).join('') : '<span class="muted">暂无</span>'}
    </div>
  </div>`;
}

function allWorkflowTasks(workflow) {
  return [workflow.angleReference, ...workflow.ecommerceImages, ...workflow.skuImages];
}

function taskKey(task) {
  return `${task.taskType}:${task.taskId}`;
}
