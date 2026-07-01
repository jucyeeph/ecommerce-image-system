import express from 'express';
import { createProject, getProject, listProjects, updateProject } from '../services/projectService.js';

export function projectsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res, next) => {
    try {
      res.json(listProjects(db));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', (req, res, next) => {
    try {
      res.status(201).json(createProject(db, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      res.json(getProject(db, req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', (req, res, next) => {
    try {
      res.json(updateProject(db, req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

