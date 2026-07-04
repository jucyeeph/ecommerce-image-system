import fs from 'node:fs/promises';
import path from 'node:path';
import { paths } from '../config/paths.js';
import { listProjectsFromDb, saveProjectIndex } from '../db/init.js';

export async function saveProject(project) {
  try {
    saveProjectIndex(project);
  } catch {
    await writeFallbackIndex(project);
  }
}

export async function listProjects() {
  try {
    const rows = listProjectsFromDb();
    if (rows.length) return rows;
  } catch {
    // Fall back to project folders when sqlite3 is not installed locally.
  }
  const entries = await fs.readdir(paths.projectsDir, { withFileTypes: true }).catch(() => []);
  const projects = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    try {
      const projectPath = path.join(paths.projectsDir, entry.name);
      const product = JSON.parse(await fs.readFile(path.join(projectPath, '00_source/product_info.json'), 'utf8'));
      const status = JSON.parse(await fs.readFile(path.join(projectPath, 'project_status.json'), 'utf8'));
      projects.push({
        project_id: entry.name,
        project_name: entry.name,
        parent_sku: product.parent_sku,
        product_name: product.product_name,
        project_path: projectPath,
        total_skus: status.total_skus,
        downloaded_images: status.downloaded_images,
        failed_images: status.failed_images,
        status: status.import_status,
        updated_at: product.created_at
      });
    } catch {
      // Ignore incomplete folders.
    }
  }
  return projects.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

async function writeFallbackIndex(project) {
  await fs.mkdir(paths.dataDir, { recursive: true });
  const indexPath = path.join(paths.dataDir, 'projects-index.json');
  const current = JSON.parse(await fs.readFile(indexPath, 'utf8').catch(() => '[]'));
  const withoutExisting = current.filter((item) => item.project_id !== project.projectId);
  withoutExisting.unshift({
    project_id: project.projectId,
    project_name: project.projectId,
    parent_sku: project.product.parent_sku,
    product_name: project.product.product_name,
    project_path: project.projectPath,
    total_skus: project.status.totalSkus,
    total_images: project.status.totalImages,
    downloaded_images: project.status.downloadedImages,
    failed_images: project.status.failedImages,
    status: project.status.status,
    updated_at: new Date().toISOString()
  });
  await fs.writeFile(indexPath, `${JSON.stringify(withoutExisting, null, 2)}\n`, 'utf8');
}
