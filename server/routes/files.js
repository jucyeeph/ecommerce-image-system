import express from 'express';
import fs from 'fs';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { getFileRecord, getProjectFiles, handleHermesZip, handleStageUpload, selectFinalFile } from '../services/fileService.js';
import { getProject } from '../services/projectService.js';

const upload = multer({
  dest: path.join(os.tmpdir(), 'ecommerce-image-workbench-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }
});

export function filesRouter(db) {
  const router = express.Router();

  router.post('/projects/:id/upload/hermes-zip', upload.single('file'), (req, res, next) => {
    try {
      if (!req.file) {
        const error = new Error('请上传 zip 文件');
        error.status = 400;
        throw error;
      }
      if (path.extname(req.file.originalname).toLowerCase() !== '.zip') {
        fs.unlinkSync(req.file.path);
        const error = new Error('只支持 zip 文件');
        error.status = 400;
        throw error;
      }
      res.json(handleHermesZip(db, req.params.id, req.file));
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects/:id/stages/:stageKey/upload', upload.array('files', 20), (req, res, next) => {
    try {
      res.json(handleStageUpload(db, req.params.id, req.params.stageKey, req.files || []));
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id/files', (req, res, next) => {
    try {
      getProject(db, req.params.id);
      res.json(getProjectFiles(db, req.params.id).map(withUrl));
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id/files/:fileId', (req, res, next) => {
    try {
      const file = getFileRecord(db, req.params.fileId);
      if (Number(file.project_id) !== Number(req.params.id)) {
        const error = new Error('文件不属于当前项目');
        error.status = 404;
        throw error;
      }
      res.json(withUrl(file));
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id/files/:fileId/content', (req, res, next) => {
    try {
      const file = getFileRecord(db, req.params.fileId);
      if (Number(file.project_id) !== Number(req.params.id)) {
        const error = new Error('文件不属于当前项目');
        error.status = 404;
        throw error;
      }
      res.sendFile(path.resolve(file.file_path));
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects/:id/stages/:stageKey/select-final', (req, res, next) => {
    try {
      res.json(selectFinalFile(db, req.params.id, req.params.stageKey, req.body.file_id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function withUrl(file) {
  return { ...file, url: `/api/projects/${file.project_id}/files/${file.id}/content` };
}

