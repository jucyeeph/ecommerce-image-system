import 'dotenv/config';
import express from 'express';
import { paths } from './config/paths.js';
import { initDatabase } from './db/init.js';
import { indexRoutes } from './routes/indexRoutes.js';
import { importRoutes } from './routes/importRoutes.js';
import { projectRoutes } from './routes/projectRoutes.js';
import { ensureDir } from './services/fileWriter.js';

await Promise.all([ensureDir(paths.uploadsDir), ensureDir(paths.projectsDir), ensureDir(paths.dataDir)]);
initDatabase();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(paths.publicDir));
app.use('/projects-assets', express.static(paths.projectsDir));
app.use(indexRoutes);
app.use(importRoutes);
app.use(projectRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.statusCode || 500).json({ error: error.message || '服务器错误' });
});

app.listen(port, () => {
  console.log(`Ecommerce Image Workbench listening on http://0.0.0.0:${port}`);
});
