import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(__dirname, '../..');

export const paths = {
  appRoot,
  dataDir: process.env.DATA_DIR || path.join(appRoot, 'data'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(appRoot, 'data/uploads'),
  projectsDir: process.env.PROJECTS_DIR || path.join(appRoot, 'projects'),
  databasePath: process.env.DATABASE_PATH || path.join(appRoot, 'data/app.db'),
  publicDir: path.join(appRoot, 'public')
};
