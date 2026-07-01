import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDatabase } from './db.js';
import { filesRouter } from './routes/files.js';
import { projectsRouter } from './routes/projects.js';
import { stagesRouter } from './routes/stages.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || process.env.APP_INTERNAL_PORT || 3088);
const host = process.env.HOST || '0.0.0.0';
const db = openDatabase();

fs.mkdirSync(process.env.DATA_DIR || path.resolve('data'), { recursive: true });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/projects', projectsRouter(db));
app.use('/api/projects/:id/stages', stagesRouter(db));
app.use('/api', filesRouter(db));

const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error, req, res, next) => {
  if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  for (const file of req.files || []) {
    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Server error' });
});

app.listen(port, host, () => {
  console.log(`Ecommerce image workbench listening on ${host}:${port}`);
});
