import path from 'path';

export function dataDir() {
  return path.resolve(process.env.DATA_DIR || 'data');
}

export function projectsDir() {
  return path.resolve(process.env.PROJECTS_DIR || path.join(dataDir(), 'projects'));
}

export function toRelativePath(filePath) {
  return path.relative(process.cwd(), filePath);
}

export function publicFileUrl(fileId) {
  return `/api/projects/files/${fileId}/content`;
}

