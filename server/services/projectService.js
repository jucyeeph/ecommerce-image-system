import fs from 'fs';
import path from 'path';
import { projectsDir, toRelativePath } from './pathUtils.js';
import { renderTemplate, writePrompt, recordPromptVersion, summarizeProductIntro } from './promptService.js';

export const STAGES = [
  { key: 'hermes_collection', name: 'Hermes 采集' },
  { key: 'product_cutout_material', name: '白底素材' },
  { key: 'main_image', name: '主图生成' }
];

const PROJECT_DIRS = [
  '00_project_meta',
  '01_hermes_collection/raw_material_package/product_original_images',
  '01_hermes_collection/raw_material_package/sku_original_images',
  '01_hermes_collection/raw_material_package/source_screenshots',
  '02_product_cutout_material/chatgpt_input_package',
  '02_product_cutout_material/generated_white_bg',
  '02_product_cutout_material/selected_white_bg',
  '03_main_image/chatgpt_input_package',
  '03_main_image/generated',
  '03_main_image/final',
  '06_brand_assets_used/logo',
  '06_brand_assets_used/color_palette',
  '06_brand_assets_used/reference_images',
  '99_archive'
];

export function createProject(db, input) {
  if (!input.source_url?.trim()) {
    const error = new Error('产品链接必填');
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const dateCode = formatDate(now);
  const sequence = nextSequence(db, dateCode);
  const projectCode = `${dateCode}-${sequence}`;
  const projectName = `${projectCode}-pending-product-name`;
  const projectPath = path.join(projectsDir(), projectName);

  createProjectFolders(projectPath);

  const payload = {
    project_code: projectCode,
    project_name: projectName,
    source_url: input.source_url.trim(),
    source_platform: input.source_platform || '1688',
    brand: input.brand || 'JUCYEE | BOMD',
    category: input.category || 'Nail Gel',
    target_platform: input.target_platform || 'Shopee PH',
    include_sku: input.include_sku !== false
  };

  fs.writeFileSync(path.join(projectPath, '00_project_meta/product_link.txt'), payload.source_url, 'utf8');
  fs.writeFileSync(path.join(projectPath, '00_project_meta/project_notes.md'), '# Project Notes\n', 'utf8');
  fs.writeFileSync(path.join(projectPath, '00_project_meta/progress_log.md'), `# Progress Log\n\n- ${now.toISOString()} Project created.\n`, 'utf8');
  fs.writeFileSync(path.join(projectPath, '00_project_meta/project.json'), JSON.stringify(payload, null, 2), 'utf8');
  touchDefaults(projectPath);

  const timestamp = now.toISOString();
  const result = db.prepare(`
    INSERT INTO projects
      (project_code, project_name, source_url, source_platform, brand, category, target_platform, status, current_stage, project_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'created', 'hermes_collection', ?, ?, ?)
  `).run(
    projectCode,
    projectName,
    payload.source_url,
    payload.source_platform,
    payload.brand,
    payload.category,
    payload.target_platform,
    projectPath,
    timestamp,
    timestamp
  );

  const projectId = Number(result.lastInsertRowid);
  for (const stage of STAGES) {
    const status = stage.key === 'hermes_collection' ? 'prompt_ready' : 'not_started';
    db.prepare(`
      INSERT INTO project_stages
        (project_id, stage_key, stage_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, stage.key, stage.name, status, timestamp, timestamp);
  }

  const hermesPrompt = renderTemplate('hermes_collection', payload);
  const hermesPromptPath = writePrompt(projectPath, 'hermes_collection', hermesPrompt);
  recordPromptVersion(db, projectId, 'hermes_collection', toRelativePath(hermesPromptPath), 'hermes_prompt');
  db.prepare(`
    UPDATE project_stages
    SET prompt_path = ?, updated_at = ?
    WHERE project_id = ? AND stage_key = 'hermes_collection'
  `).run(toRelativePath(hermesPromptPath), timestamp, projectId);

  return getProject(db, projectId);
}

export function listProjects(db) {
  return db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM sku_items s WHERE s.project_id = p.id) AS sku_count
    FROM projects p
    ORDER BY p.updated_at DESC
  `).all();
}

export function getProject(db, id) {
  const project = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM sku_items s WHERE s.project_id = p.id) AS sku_count
    FROM projects p
    WHERE p.id = ?
  `).get(id);
  if (!project) {
    const error = new Error('项目不存在');
    error.status = 404;
    throw error;
  }
  project.stages = db.prepare('SELECT * FROM project_stages WHERE project_id = ? ORDER BY id').all(id);
  project.files = db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY id DESC').all(id);
  project.skus = db.prepare('SELECT * FROM sku_items WHERE project_id = ? ORDER BY id').all(id);
  project.product_intro_summary = summarizeProductIntro(project.project_path);
  return project;
}

export function updateProject(db, id, patch) {
  getProject(db, id);
  const allowed = ['project_name', 'brand', 'category', 'target_platform', 'status', 'current_stage'];
  const entries = Object.entries(patch).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getProject(db, id);
  const now = new Date().toISOString();
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  db.prepare(`UPDATE projects SET ${assignments}, updated_at = ? WHERE id = ?`).run(
    ...entries.map(([, value]) => value),
    now,
    id
  );
  return getProject(db, id);
}

export function updateProjectNameFromIntro(db, project, suggestedName) {
  if (!suggestedName) return { renamed: false };
  const slug = slugify(suggestedName);
  if (!slug) return { renamed: false };
  const newName = `${project.project_code}-${slug}`;
  const newPath = path.join(projectsDir(), newName);
  let renameWarning = null;

  if (project.project_path !== newPath) {
    try {
      if (!fs.existsSync(newPath)) fs.renameSync(project.project_path, newPath);
      else renameWarning = `目标文件夹已存在：${newName}`;
    } catch (error) {
      renameWarning = `项目文件夹重命名失败，请手动处理：${error.message}`;
    }
  }

  const finalPath = renameWarning ? project.project_path : newPath;
  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET project_name = ?, project_path = ?, updated_at = ? WHERE id = ?').run(newName, finalPath, now, project.id);
  return { renamed: !renameWarning, renameWarning, project_name: newName, project_path: finalPath };
}

function createProjectFolders(projectPath) {
  for (const dir of PROJECT_DIRS) fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
}

function touchDefaults(projectPath) {
  const files = {
    '01_hermes_collection/hermes_result_summary.md': '',
    '01_hermes_collection/product_intro.md': '',
    '01_hermes_collection/sku_info.md': '',
    '01_hermes_collection/sku_info.json': '{\n  "sku_list": []\n}\n',
    '03_main_image/prompt_default.md': fs.readFileSync(path.resolve('server/templates/image_01_main.md'), 'utf8'),
    '06_brand_assets_used/brand_intro.md': '# Brand Intro\n\nJUCYEE | BOMD\n',
    '06_brand_assets_used/brand_visual_guide.md': '# Brand Visual Guide\n'
  };
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(projectPath, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, content, 'utf8');
  }
}

function nextSequence(db, dateCode) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM projects WHERE project_code LIKE ?').get(`${dateCode}-%`);
  return String(Number(row.count) + 1).padStart(3, '0');
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function slugify(value) {
  return value
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

