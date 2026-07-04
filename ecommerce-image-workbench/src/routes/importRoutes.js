import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { paths } from '../config/paths.js';
import { createProjectFromImport } from '../services/projectCreator.js';
import { saveProject } from '../services/projectStore.js';

const upload = multer({
  dest: paths.uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 }
});

export const importRoutes = Router();

importRoutes.post('/api/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('请上传 BigSeller .xlsx 文件');
      error.statusCode = 400;
      throw error;
    }
    if (path.extname(req.file.originalname).toLowerCase() !== '.xlsx') {
      const error = new Error('上传文件必须是 .xlsx');
      error.statusCode = 400;
      throw error;
    }

    const project = await createProjectFromImport({
      sourceFilePath: req.file.path,
      projectsRoot: paths.projectsDir
    });
    project.sourceFilePath = req.file.path;
    await saveProject(project);
    res.json({ project });
  } catch (error) {
    next(error);
  }
});
