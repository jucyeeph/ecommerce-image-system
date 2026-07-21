import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config/paths.js';

const schemaPath = path.join(paths.appRoot, 'src/db/schema.sql');

export function initDatabase() {
  fs.mkdirSync(path.dirname(paths.databasePath), { recursive: true });
  const schema = fs.readFileSync(schemaPath, 'utf8');
  runSql(schema);
}

export function saveProjectIndex(project) {
  const now = new Date().toISOString();
  runSql(
    `INSERT OR REPLACE INTO projects
      (project_id, project_name, parent_sku, product_name, project_path, source_file_path, total_skus, total_images, downloaded_images, failed_images, status, created_at, updated_at)
     VALUES
      (${q(project.projectId)}, ${q(project.projectId)}, ${q(project.product.parent_sku)}, ${q(project.product.product_name)}, ${q(project.projectPath)}, ${q(project.sourceFilePath || '')}, ${n(project.status.totalSkus)}, ${n(project.status.totalImages)}, ${n(project.status.downloadedImages)}, ${n(project.status.failedImages)}, ${q(project.status.status)}, COALESCE((SELECT created_at FROM projects WHERE project_id = ${q(project.projectId)}), ${q(now)}), ${q(now)});`
  );
}

export function listProjectsFromDb() {
  const output = runSql(`SELECT json_group_array(json_object(
    'project_id', project_id,
    'project_name', project_name,
    'parent_sku', parent_sku,
    'product_name', product_name,
    'project_path', project_path,
    'total_skus', total_skus,
    'total_images', total_images,
    'downloaded_images', downloaded_images,
    'failed_images', failed_images,
    'status', status,
    'created_at', created_at,
    'updated_at', updated_at
  )) FROM projects ORDER BY updated_at DESC;`);
  return JSON.parse(output.trim() || '[]') || [];
}

function runSql(sql) {
  const result = spawnSync('sqlite3', [paths.databasePath, sql], {
    encoding: 'utf8'
  });
  if (result.error?.code === 'ENOENT') {
    return '';
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || 'sqlite3 command failed');
  }
  return result.stdout;
}

function q(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '0';
}
