import { Router } from 'express';
import { listProjects } from '../services/projectStore.js';

export const indexRoutes = Router();

indexRoutes.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

indexRoutes.get('/api/projects', async (req, res, next) => {
  try {
    res.json({ projects: await listProjects() });
  } catch (error) {
    next(error);
  }
});
