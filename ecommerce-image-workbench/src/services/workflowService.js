import archiver from 'archiver';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { paths } from '../config/paths.js';
import { safeFilename } from '../utils/safeFilename.js';
import { ensureDir, writeJson, writeText } from './fileWriter.js';
import { getSettings, getSettingsDir } from './settingsService.js';

const ecommerceTaskIds = Array.from({ length: 9 }, (_, index) => `image_${String(index + 1).padStart(2, '0')}`);
const projectReferenceDirs = {
  angle: '05_workflow/01_angle_reference/uploaded_results',
  style: '05_workflow/00_reference_assets/style_reference'
};

export async function ensureProjectWorkflow({ projectPath, dataDir = paths.dataDir }) {
  const settings = await getSettings({ dataDir });
  const product = await readJson(path.join(projectPath, '00_source/product_info.json'));
  const skus = parseSkuCsv(await fsp.readFile(path.join(projectPath, '00_source/sku_map.csv'), 'utf8'));

  const angleReference = await ensureTask({
    projectPath,
    taskType: 'angle',
    taskId: 'angle_reference',
    title: '产品角度参考图',
    prompt: settings.defaultPrompts.angle_reference
  });

  const ecommerceImages = [];
  for (const taskId of ecommerceTaskIds) {
    ecommerceImages.push(await ensureTask({
      projectPath,
      taskType: 'ecommerce',
      taskId,
      title: `电商图 ${taskId.slice(-2)}`,
      prompt: settings.defaultPrompts[`ecommerce_${taskId}`] || settings.defaultPrompts.ecommerce_image_01
    }));
  }

  const skuImages = [];
  for (const sku of skus) {
    const taskId = safeTaskId(sku.sku || sku.variation_option);
    skuImages.push(await ensureTask({
      projectPath,
      taskType: 'sku',
      taskId,
      title: sku.sku || sku.variation_option,
      prompt: settings.defaultPrompts.sku_image,
      sku
    }));
  }

  const workflow = {
    product,
    angleReference,
    ecommerceImages,
    skuImages,
    projectReferences: await listProjectReferences(projectPath)
  };
  await writeJson(path.join(projectPath, '05_workflow/workflow_index.json'), workflow);
  return workflow;
}

export async function saveTaskPrompt({ projectPath, taskType, taskId, prompt }) {
  const task = await readTask(projectPath, taskType, taskId);
  task.prompt = prompt;
  task.promptEdited = true;
  task.updatedAt = new Date().toISOString();
  await writeText(path.join(projectPath, task.relativePath, 'prompt.md'), prompt);
  await writeJson(path.join(projectPath, task.relativePath, 'metadata.json'), task);
  return task;
}

export async function buildTaskPackage({ projectPath, dataDir = paths.dataDir, taskType, taskId }) {
  await ensureProjectWorkflow({ projectPath, dataDir });
  const task = await readTask(projectPath, taskType, taskId);
  const taskDir = path.join(projectPath, task.relativePath);
  const zipPath = path.join(taskDir, 'input_package.zip');
  await ensureDir(taskDir);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);

  archive.file(path.join(taskDir, 'prompt.md'), { name: 'prompt.md' });
  archive.append(await buildProductBrief(projectPath), { name: 'product_brief.md' });
  await addExistingDir(archive, path.join(projectPath, '01_downloaded_images/main'), 'source_images/main');
  await addExistingDir(archive, path.join(projectPath, '01_downloaded_images/detail'), 'source_images/detail');
  await addExistingDir(archive, path.join(projectPath, '05_workflow/01_angle_reference/uploaded_results'), 'generated_materials/angle_reference');
  await addExistingDir(archive, path.join(projectPath, projectReferenceDirs.style), 'style_reference/project');
  await addSettingsAssets(archive, dataDir);

  if (taskType === 'ecommerce') {
    await addPreviousEcommerceResults(archive, projectPath, taskId);
  }
  if (taskType === 'sku' && task.sku?.local_image_path) {
    const skuImage = path.join(projectPath, task.sku.local_image_path);
    if (fs.existsSync(skuImage)) archive.file(skuImage, { name: `sku_source/${path.basename(skuImage)}` });
  }

  await archive.finalize();
  await done;

  task.packagePath = path.relative(projectPath, zipPath);
  task.status = 'packaged';
  task.updatedAt = new Date().toISOString();
  await writeJson(path.join(taskDir, 'metadata.json'), task);
  return zipPath;
}

export async function saveTaskUpload({ projectPath, taskType, taskId, file }) {
  const task = await readTask(projectPath, taskType, taskId);
  const uploadDir = path.join(projectPath, task.relativePath, 'uploaded_results');
  await ensureDir(uploadDir);
  const fileName = `${Date.now()}_${safeFilename(file.originalname || 'result')}`;
  const target = path.join(uploadDir, fileName);
  await fsp.copyFile(file.path, target);
  await fsp.unlink(file.path).catch(() => {});
  task.uploadedResults = await listFiles(uploadDir, path.join(task.relativePath, 'uploaded_results'));
  task.status = 'uploaded';
  task.updatedAt = new Date().toISOString();
  await writeJson(path.join(projectPath, task.relativePath, 'metadata.json'), task);
  return task;
}

export async function saveReferenceUpload({ projectPath, dataDir = paths.dataDir, referenceType, file }) {
  const relativeDir = projectReferenceDir(referenceType);
  const uploadDir = path.join(projectPath, relativeDir);
  await ensureDir(uploadDir);
  const fileName = `${Date.now()}_${safeFilename(file.originalname || `${referenceType}-reference`)}`;
  const target = path.join(uploadDir, fileName);
  await fsp.copyFile(file.path, target);
  await fsp.unlink(file.path).catch(() => {});
  return ensureProjectWorkflow({ projectPath, dataDir });
}

export function taskPath(taskType, taskId) {
  if (taskType === 'angle') return '05_workflow/01_angle_reference';
  if (taskType === 'ecommerce') return `05_workflow/02_ecommerce_images/${taskId}`;
  if (taskType === 'sku') return `05_workflow/03_sku_images/${taskId}`;
  throw Object.assign(new Error('Unsupported workflow task type'), { statusCode: 400 });
}

function projectReferenceDir(referenceType) {
  const relativeDir = projectReferenceDirs[referenceType];
  if (!relativeDir) {
    throw Object.assign(new Error('Unsupported reference type'), { statusCode: 400 });
  }
  return relativeDir;
}

async function ensureTask({ projectPath, taskType, taskId, title, prompt, sku }) {
  const relativePath = taskPath(taskType, taskId);
  const taskDir = path.join(projectPath, relativePath);
  const metadataPath = path.join(taskDir, 'metadata.json');
  await Promise.all([
    ensureDir(path.join(taskDir, 'uploaded_results')),
    ensureDir(path.join(taskDir, 'selected'))
  ]);

  let task;
  try {
    task = JSON.parse(await fsp.readFile(metadataPath, 'utf8'));
  } catch {
    task = {
      taskType,
      taskId,
      title,
      status: 'not_started',
      relativePath,
      prompt,
      promptEdited: false,
      uploadedResults: [],
      sku: sku || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeText(path.join(taskDir, 'prompt.md'), prompt);
  }

  task.uploadedResults = await listFiles(path.join(taskDir, 'uploaded_results'), path.join(relativePath, 'uploaded_results'));
  await writeJson(metadataPath, task);
  return task;
}

async function listProjectReferences(projectPath) {
  await ensureDir(path.join(projectPath, projectReferenceDirs.style));
  return {
    angle: await listFiles(path.join(projectPath, projectReferenceDirs.angle), projectReferenceDirs.angle),
    style: await listFiles(path.join(projectPath, projectReferenceDirs.style), projectReferenceDirs.style)
  };
}

async function readTask(projectPath, taskType, taskId) {
  const relativePath = taskPath(taskType, taskId);
  return readJson(path.join(projectPath, relativePath, 'metadata.json'));
}

async function addExistingDir(archive, absoluteDir, zipPrefix) {
  if (!fs.existsSync(absoluteDir)) return;
  const files = await fsp.readdir(absoluteDir, { withFileTypes: true });
  for (const file of files) {
    if (file.isFile()) {
      archive.file(path.join(absoluteDir, file.name), { name: `${zipPrefix}/${file.name}` });
    }
  }
}

async function addSettingsAssets(archive, dataDir) {
  const settingsDir = getSettingsDir(dataDir);
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/logo'), 'brand_assets/logo');
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/brand_refs'), 'brand_assets/brand_refs');
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/background_refs'), 'brand_assets/background_refs');
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/angle_refs'), 'generated_materials/global_angle_refs');
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/style_refs'), 'style_reference/settings');
}

async function addPreviousEcommerceResults(archive, projectPath, taskId) {
  const currentIndex = Number(taskId.split('_')[1]);
  for (let index = 1; index < currentIndex; index++) {
    const previousId = `image_${String(index).padStart(2, '0')}`;
    await addExistingDir(
      archive,
      path.join(projectPath, taskPath('ecommerce', previousId), 'uploaded_results'),
      `style_reference/${previousId}`
    );
  }
}

async function buildProductBrief(projectPath) {
  const product = await readJson(path.join(projectPath, '00_source/product_info.json'));
  return `# Product Brief

## Product

- Product name: ${product.product_name || ''}
- Parent SKU: ${product.parent_sku || ''}
- Brand: ${product.brand || ''}
- Product type: ${product.product_type || ''}
- Supplier URL: ${product.supplier_url || ''}

## Product Description

${product.description || ''}
`;
}

function safeTaskId(value) {
  return safeFilename(value || 'sku').replace(/\s+/g, '-');
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}

async function listFiles(absoluteDir, relativeDir) {
  const files = await fsp.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
  return files.filter((file) => file.isFile()).map((file) => ({
    name: file.name,
    path: path.join(relativeDir, file.name)
  }));
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
