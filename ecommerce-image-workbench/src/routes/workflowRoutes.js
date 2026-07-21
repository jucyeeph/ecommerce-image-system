import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { paths } from '../config/paths.js';
import {
  buildTaskPackage,
  ensureProjectWorkflow,
  saveReferenceUpload,
  saveTaskPrompt,
  saveTaskUpload
} from '../services/workflowService.js';

const upload = multer({ dest: paths.uploadsDir, limits: { fileSize: 60 * 1024 * 1024 } });

export const workflowRoutes = Router();

workflowRoutes.get('/api/projects/:projectId/workflow', async (req, res, next) => {
  try {
    const projectPath = getProjectPath(req.params.projectId);
    res.json({ workflow: await ensureProjectWorkflow({ projectPath }) });
  } catch (error) {
    next(error);
  }
});

workflowRoutes.get('/api/projects/:projectId/workflow/tasks/:taskType/:taskId/package', downloadTaskPackage);
workflowRoutes.post('/api/projects/:projectId/workflow/tasks/:taskType/:taskId/package', downloadTaskPackage);

async function downloadTaskPackage(req, res, next) {
  try {
    const zipPath = await buildTaskPackage({
      projectPath: getProjectPath(req.params.projectId),
      taskType: req.params.taskType,
      taskId: req.params.taskId
    });
    res.download(zipPath, `${req.params.projectId}_${req.params.taskId}_chatgpt_package.zip`);
  } catch (error) {
    next(error);
  }
}

workflowRoutes.put('/api/projects/:projectId/workflow/tasks/:taskType/:taskId/prompt', async (req, res, next) => {
  try {
    const task = await saveTaskPrompt({
      projectPath: getProjectPath(req.params.projectId),
      taskType: req.params.taskType,
      taskId: req.params.taskId,
      prompt: req.body.prompt || ''
    });
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

workflowRoutes.post('/api/projects/:projectId/workflow/tasks/:taskType/:taskId/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('请上传生成结果图片'), { statusCode: 400 });
    }
    const task = await saveTaskUpload({
      projectPath: getProjectPath(req.params.projectId),
      taskType: req.params.taskType,
      taskId: req.params.taskId,
      file: req.file
    });
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

workflowRoutes.post('/api/projects/:projectId/workflow/references/:referenceType/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('请上传参考图片'), { statusCode: 400 });
    }
    const workflow = await saveReferenceUpload({
      projectPath: getProjectPath(req.params.projectId),
      referenceType: req.params.referenceType,
      file: req.file
    });
    res.json({ workflow });
  } catch (error) {
    next(error);
  }
});

function getProjectPath(projectId) {
  return path.join(paths.projectsDir, projectId);
}
