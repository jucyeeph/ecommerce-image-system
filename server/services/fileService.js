import fs from 'fs';
import path from 'path';
import { getProject, updateProjectNameFromIntro } from './projectService.js';
import { extractZip, copyIfFound, parseSkuJson, parseSuggestedProjectName } from './zipService.js';
import { renderTemplate, writePrompt, recordPromptVersion, summarizeProductIntro } from './promptService.js';
import { toRelativePath } from './pathUtils.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function registerFile(db, projectId, stageKey, fileType, filePath) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO project_files (project_id, stage_key, file_type, file_name, file_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, stageKey, fileType, path.basename(filePath), filePath, now);
  return result.lastInsertRowid;
}

export function getProjectFiles(db, projectId) {
  return db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY id DESC').all(projectId);
}

export function getFileRecord(db, fileId) {
  const file = db.prepare('SELECT * FROM project_files WHERE id = ?').get(fileId);
  if (!file) {
    const error = new Error('文件不存在');
    error.status = 404;
    throw error;
  }
  return file;
}

export function handleHermesZip(db, projectId, uploadedFile) {
  const project = getProject(db, projectId);
  const stageDir = path.join(project.project_path, '01_hermes_collection');
  const originalZip = path.join(stageDir, 'hermes_upload_original.zip');
  fs.mkdirSync(stageDir, { recursive: true });
  moveFileAcrossDevices(uploadedFile.path, originalZip);
  registerFile(db, projectId, 'hermes_collection', 'hermes_zip', originalZip);
  extractZip(originalZip, stageDir);

  const required = {
    product_intro: copyIfFound(stageDir, 'product_intro.md', path.join(stageDir, 'product_intro.md')),
    sku_info_md: copyIfFound(stageDir, 'sku_info.md', path.join(stageDir, 'sku_info.md')),
    sku_info_json: copyIfFound(stageDir, 'sku_info.json', path.join(stageDir, 'sku_info.json')),
    summary: copyIfFound(stageDir, 'hermes_result_summary.md', path.join(stageDir, 'hermes_result_summary.md'))
  };

  const warnings = [];
  if (!required.product_intro) warnings.push('缺少 product_intro.md');
  if (!required.sku_info_json) warnings.push('缺少 sku_info.json');

  db.prepare('DELETE FROM sku_items WHERE project_id = ?').run(projectId);
  if (required.sku_info_json) {
    for (const sku of parseSkuJson(required.sku_info_json)) {
      db.prepare(`
        INSERT INTO sku_items
          (project_id, sku_id, original_name, english_name, color_or_spec, source_image_path, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'not_started', ?)
      `).run(
        projectId,
        sku.sku_id || '',
        sku.original_name || '',
        sku.english_name || '',
        sku.color_or_spec || '',
        sku.image_file || '',
        sku.notes || ''
      );
    }
  }

  let renameResult = null;
  if (required.product_intro) {
    const intro = fs.readFileSync(required.product_intro, 'utf8');
    renameResult = updateProjectNameFromIntro(db, project, parseSuggestedProjectName(intro));
    if (renameResult?.renameWarning) warnings.push(renameResult.renameWarning);
  }

  const updatedProject = getProject(db, projectId);
  const cutoutPrompt = renderTemplate('product_cutout_material', {
    product_intro_summary: summarizeProductIntro(updatedProject.project_path)
  });
  const cutoutPath = writePrompt(updatedProject.project_path, 'product_cutout_material', cutoutPrompt);
  recordPromptVersion(db, projectId, 'product_cutout_material', toRelativePath(cutoutPath));

  const mainPrompt = renderTemplate('main_image', {
    brand: updatedProject.brand,
    product_intro_summary: summarizeProductIntro(updatedProject.project_path)
  });
  const mainPath = writePrompt(updatedProject.project_path, 'main_image', mainPrompt);
  recordPromptVersion(db, projectId, 'main_image', toRelativePath(mainPath));

  const status = warnings.length ? 'needs_fix' : 'parsed';
  const now = new Date().toISOString();
  db.prepare("UPDATE project_stages SET status = ?, updated_at = ? WHERE project_id = ? AND stage_key = 'hermes_collection'").run(status, now, projectId);
  db.prepare("UPDATE project_stages SET status = 'prompt_ready', prompt_path = ?, updated_at = ? WHERE project_id = ? AND stage_key = 'product_cutout_material'").run(toRelativePath(cutoutPath), now, projectId);
  db.prepare("UPDATE project_stages SET prompt_path = ?, updated_at = ? WHERE project_id = ? AND stage_key = 'main_image'").run(toRelativePath(mainPath), now, projectId);
  db.prepare('UPDATE projects SET current_stage = ?, updated_at = ? WHERE id = ?').run('product_cutout_material', now, projectId);

  return { project: getProject(db, projectId), warnings, renameResult };
}

export function handleStageUpload(db, projectId, stageKey, files) {
  const project = getProject(db, projectId);
  const destination = uploadDestination(project.project_path, stageKey);
  fs.mkdirSync(destination, { recursive: true });
  const records = [];
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      fs.unlinkSync(file.path);
      continue;
    }
    const target = path.join(destination, `${Date.now()}-${safeName(file.originalname)}`);
    moveFileAcrossDevices(file.path, target);
    const id = registerFile(db, projectId, stageKey, 'stage_image', target);
    records.push({ id, file_path: target, file_name: path.basename(target) });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE project_stages SET status = ?, output_path = ?, updated_at = ? WHERE project_id = ? AND stage_key = ?').run('uploaded', destination, now, projectId, stageKey);
  db.prepare('UPDATE projects SET current_stage = ?, updated_at = ? WHERE id = ?').run(stageKey, now, projectId);
  return records;
}

export function selectFinalFile(db, projectId, stageKey, fileId) {
  const project = getProject(db, projectId);
  const file = getFileRecord(db, fileId);
  if (Number(file.project_id) !== Number(projectId)) {
    const error = new Error('文件不属于当前项目');
    error.status = 400;
    throw error;
  }
  const ext = path.extname(file.file_path) || '.jpg';
  const finalPath = stageKey === 'main_image'
    ? path.join(project.project_path, '03_main_image/final/image_01_main_final.jpg')
    : path.join(project.project_path, '02_product_cutout_material/selected_white_bg', `selected_white_bg${ext}`);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  fs.copyFileSync(file.file_path, finalPath);
  registerFile(db, projectId, stageKey, 'final_image', finalPath);
  const now = new Date().toISOString();
  db.prepare('UPDATE project_stages SET final_file_path = ?, updated_at = ? WHERE project_id = ? AND stage_key = ?').run(finalPath, now, projectId, stageKey);
  return { final_file_path: finalPath };
}

function uploadDestination(projectPath, stageKey) {
  if (stageKey === 'product_cutout_material') return path.join(projectPath, '02_product_cutout_material/generated_white_bg');
  if (stageKey === 'main_image') return path.join(projectPath, '03_main_image/generated');
  return path.join(projectPath, '01_hermes_collection/raw_material_package');
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

export function moveFileAcrossDevices(source, target) {
  try {
    fs.renameSync(source, target);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.copyFileSync(source, target);
    fs.unlinkSync(source);
  }
}
