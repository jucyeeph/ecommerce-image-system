import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { paths } from '../config/paths.js';

export const projectRoutes = Router();

projectRoutes.get('/api/projects/:projectId', async (req, res, next) => {
  try {
    const projectPath = path.join(paths.projectsDir, req.params.projectId);
    const [product, status, report, skuCsv] = await Promise.all([
      readJson(path.join(projectPath, '00_source/product_info.json')),
      readJson(path.join(projectPath, 'project_status.json')),
      readJson(path.join(projectPath, '00_source/import_report.json')),
      fs.readFile(path.join(projectPath, '00_source/sku_map.csv'), 'utf8')
    ]);
    const prompts = await fs.readdir(path.join(projectPath, '02_prompts'));
    res.json({
      project: {
        project_id: req.params.projectId,
        project_path: projectPath,
        product,
        status,
        report,
        skus: parseSkuCsv(skuCsv),
        prompts
      }
    });
  } catch (error) {
    next(error);
  }
});

projectRoutes.use('/projects-assets', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function parseSkuCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || '');
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}
