const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '请求失败');
  return payload;
}

export const api = {
  projects: () => request('/projects'),
  createProject: (payload) => request('/projects', { method: 'POST', body: JSON.stringify(payload) }),
  project: (id) => request(`/projects/${id}`),
  updateProject: (id, payload) => request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  stage: (id, stageKey) => request(`/projects/${id}/stages/${stageKey}`),
  stages: (id) => request(`/projects/${id}/stages`),
  prompt: (id, stageKey) => request(`/projects/${id}/stages/${stageKey}/prompt`),
  savePrompt: (id, stageKey, content) => request(`/projects/${id}/stages/${stageKey}/prompt`, { method: 'PUT', body: JSON.stringify({ content }) }),
  resetPrompt: (id, stageKey) => request(`/projects/${id}/stages/${stageKey}/prompt/reset`, { method: 'POST' }),
  uploadHermes: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/projects/${id}/upload/hermes-zip`, { method: 'POST', body: form });
  },
  uploadStage: (id, stageKey, files) => {
    const form = new FormData();
    [...files].forEach((file) => form.append('files', file));
    return request(`/projects/${id}/stages/${stageKey}/upload`, { method: 'POST', body: form });
  },
  files: (id) => request(`/projects/${id}/files`),
  selectFinal: (id, stageKey, fileId) => request(`/projects/${id}/stages/${stageKey}/select-final`, {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId })
  }),
  approve: (id, stageKey) => request(`/projects/${id}/stages/${stageKey}/approve`, { method: 'POST' }),
  revision: (id, stageKey) => request(`/projects/${id}/stages/${stageKey}/revision`, { method: 'POST' })
};

