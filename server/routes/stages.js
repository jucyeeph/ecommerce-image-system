import express from 'express';
import fs from 'fs';
import path from 'path';
import { getProject } from '../services/projectService.js';
import { readPrompt, recordPromptVersion, renderTemplate, stagePromptRelativePath, summarizeProductIntro, writePrompt } from '../services/promptService.js';
import { toRelativePath } from '../services/pathUtils.js';

export function stagesRouter(db) {
  const router = express.Router({ mergeParams: true });

  router.get('/', (req, res, next) => {
    try {
      getProject(db, req.params.id);
      res.json(db.prepare('SELECT * FROM project_stages WHERE project_id = ? ORDER BY id').all(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:stageKey', (req, res, next) => {
    try {
      const project = getProject(db, req.params.id);
      const stage = getStage(req.params.id, req.params.stageKey);
      const files = db.prepare('SELECT * FROM project_files WHERE project_id = ? AND stage_key = ? ORDER BY id DESC').all(req.params.id, req.params.stageKey);
      res.json({ project, stage, files, product_intro_summary: summarizeProductIntro(project.project_path) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:stageKey', (req, res, next) => {
    try {
      getProject(db, req.params.id);
      const allowed = ['status', 'notes'];
      const entries = Object.entries(req.body).filter(([key]) => allowed.includes(key));
      if (entries.length) {
        const now = new Date().toISOString();
        const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
        db.prepare(`UPDATE project_stages SET ${assignments}, updated_at = ? WHERE project_id = ? AND stage_key = ?`).run(
          ...entries.map(([, value]) => value),
          now,
          req.params.id,
          req.params.stageKey
        );
      }
      res.json(getStage(req.params.id, req.params.stageKey));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:stageKey/approve', (req, res, next) => {
    try {
      const status = req.params.stageKey === 'hermes_collection' ? 'done' : 'approved';
      updateStageStatus(req.params.id, req.params.stageKey, status);
      res.json(getStage(req.params.id, req.params.stageKey));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:stageKey/revision', (req, res, next) => {
    try {
      const status = req.params.stageKey === 'hermes_collection' ? 'needs_fix' : 'needs_revision';
      updateStageStatus(req.params.id, req.params.stageKey, status);
      res.json(getStage(req.params.id, req.params.stageKey));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:stageKey/prompt', (req, res, next) => {
    try {
      const project = getProject(db, req.params.id);
      const prompt = readPrompt(project.project_path, req.params.stageKey);
      res.json({ content: prompt.content, prompt_path: toRelativePath(prompt.promptPath) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:stageKey/prompt', (req, res, next) => {
    try {
      const project = getProject(db, req.params.id);
      const promptPath = writePrompt(project.project_path, req.params.stageKey, req.body.content || '');
      recordPromptVersion(db, project.id, req.params.stageKey, toRelativePath(promptPath));
      db.prepare('UPDATE project_stages SET prompt_path = ?, updated_at = ? WHERE project_id = ? AND stage_key = ?').run(
        toRelativePath(promptPath),
        new Date().toISOString(),
        project.id,
        req.params.stageKey
      );
      res.json({ content: req.body.content || '', prompt_path: toRelativePath(promptPath) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:stageKey/prompt/reset', (req, res, next) => {
    try {
      const project = getProject(db, req.params.id);
      const content = renderTemplate(req.params.stageKey, {
        source_url: project.source_url,
        brand: project.brand,
        category: project.category,
        target_platform: project.target_platform,
        product_intro_summary: summarizeProductIntro(project.project_path)
      });
      const promptPath = writePrompt(project.project_path, req.params.stageKey, content);
      if (req.params.stageKey === 'main_image') {
        const defaultPath = path.join(project.project_path, '03_main_image/prompt_default.md');
        fs.writeFileSync(defaultPath, content, 'utf8');
      }
      recordPromptVersion(db, project.id, req.params.stageKey, toRelativePath(promptPath));
      res.json({ content, prompt_path: toRelativePath(promptPath) });
    } catch (error) {
      next(error);
    }
  });

  function getStage(projectId, stageKey) {
    const stage = db.prepare('SELECT * FROM project_stages WHERE project_id = ? AND stage_key = ?').get(projectId, stageKey);
    if (!stage) {
      const error = new Error('阶段不存在');
      error.status = 404;
      throw error;
    }
    return stage;
  }

  function updateStageStatus(projectId, stageKey, status) {
    const now = new Date().toISOString();
    db.prepare('UPDATE project_stages SET status = ?, updated_at = ? WHERE project_id = ? AND stage_key = ?').run(status, now, projectId, stageKey);
    if (stageKey === 'hermes_collection' && status === 'done') {
      db.prepare('UPDATE projects SET current_stage = ?, updated_at = ? WHERE id = ?').run('product_cutout_material', now, projectId);
    } else if (stageKey === 'product_cutout_material' && status === 'approved') {
      db.prepare('UPDATE projects SET current_stage = ?, updated_at = ? WHERE id = ?').run('main_image', now, projectId);
    } else {
      db.prepare('UPDATE projects SET current_stage = ?, updated_at = ? WHERE id = ?').run(stageKey, now, projectId);
    }
  }

  return router;
}
