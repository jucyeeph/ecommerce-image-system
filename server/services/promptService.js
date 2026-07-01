import fs from 'fs';
import path from 'path';

const TEMPLATE_BY_STAGE = {
  hermes_collection: 'hermes_collect_1688.md',
  product_cutout_material: 'extract_white_bg_product.md',
  main_image: 'image_01_main.md'
};

const PROMPT_FILE_BY_STAGE = {
  hermes_collection: '01_hermes_collection/hermes_prompt.md',
  product_cutout_material: '02_product_cutout_material/prompt_extract_white_bg.md',
  main_image: '03_main_image/prompt_project.md'
};

export function templatePath(stageKey) {
  const templateName = TEMPLATE_BY_STAGE[stageKey];
  if (!templateName) throw new Error(`Unknown stage: ${stageKey}`);
  return path.resolve('server/templates', templateName);
}

export function stagePromptRelativePath(stageKey) {
  return PROMPT_FILE_BY_STAGE[stageKey];
}

export function renderTemplate(stageKey, variables = {}) {
  const raw = fs.readFileSync(templatePath(stageKey), 'utf8');
  return raw.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => variables[key] ?? '');
}

export function writePrompt(projectPath, stageKey, content) {
  const promptPath = path.join(projectPath, stagePromptRelativePath(stageKey));
  fs.mkdirSync(path.dirname(promptPath), { recursive: true });
  fs.writeFileSync(promptPath, content, 'utf8');
  return promptPath;
}

export function readPrompt(projectPath, stageKey) {
  const promptPath = path.join(projectPath, stagePromptRelativePath(stageKey));
  return {
    promptPath,
    content: fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : ''
  };
}

export function summarizeProductIntro(projectPath) {
  const introPath = path.join(projectPath, '01_hermes_collection/product_intro.md');
  if (!fs.existsSync(introPath)) return '暂无产品介绍。';
  const text = fs.readFileSync(introPath, 'utf8').trim();
  return text.length > 1800 ? `${text.slice(0, 1800)}\n\n...` : text;
}

export function recordPromptVersion(db, projectId, stageKey, promptPath, promptType = 'stage_prompt') {
  const active = db.prepare(`
    SELECT COALESCE(MAX(version), 0) AS version
    FROM prompt_versions
    WHERE project_id = ? AND stage_key = ? AND prompt_type = ?
  `).get(projectId, stageKey, promptType);
  db.prepare(`
    UPDATE prompt_versions
    SET is_active = 0
    WHERE project_id = ? AND stage_key = ? AND prompt_type = ?
  `).run(projectId, stageKey, promptType);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO prompt_versions
      (project_id, stage_key, prompt_type, prompt_path, version, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(projectId, stageKey, promptType, promptPath, Number(active.version) + 1, now, now);
}

