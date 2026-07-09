import { Router } from 'express';
import multer from 'multer';
import { paths } from '../config/paths.js';
import { getSettings, saveDefaultPrompts, saveGenerationAsset } from '../services/settingsService.js';

const upload = multer({ dest: paths.uploadsDir, limits: { fileSize: 30 * 1024 * 1024 } });

export const settingsRoutes = Router();

settingsRoutes.get('/api/settings', async (req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    next(error);
  }
});

settingsRoutes.put('/api/settings/prompts', async (req, res, next) => {
  try {
    res.json(await saveDefaultPrompts({ prompts: req.body.defaultPrompts || {} }));
  } catch (error) {
    next(error);
  }
});

settingsRoutes.post('/api/settings/assets/:category', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('请上传素材文件'), { statusCode: 400 });
    }
    res.json(await saveGenerationAsset({ category: req.params.category, file: req.file }));
  } catch (error) {
    next(error);
  }
});
