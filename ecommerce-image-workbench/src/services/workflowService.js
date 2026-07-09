import archiver from 'archiver';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { paths } from '../config/paths.js';
import { safeFilename } from '../utils/safeFilename.js';
import { ensureDir, writeJson, writeText } from './fileWriter.js';
import { getSettings, getSettingsDir } from './settingsService.js';

const ecommerceTaskIds = Array.from({ length: 9 }, (_, index) => `image_${String(index + 1).padStart(2, '0')}`);

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
    skuImages
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

  archive.file(path.join(projectPath, '00_source/product_info.json'), { name: 'product_info.json' });
  archive.file(path.join(projectPath, '00_source/image_urls.json'), { name: 'image_urls.json' });
  archive.file(path.join(taskDir, 'prompt.md'), { name: 'prompt.md' });
  archive.append(await buildInstructionText(task), { name: 'README_FOR_CHATGPT.md' });
  await addExistingDir(archive, path.join(projectPath, '01_downloaded_images/main'), 'source_images/main');
  await addExistingDir(archive, path.join(projectPath, '01_downloaded_images/detail'), 'source_images/detail');
  await addExistingDir(archive, path.join(projectPath, '05_workflow/01_angle_reference/uploaded_results'), 'generated_materials/angle_reference');
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

export function taskPath(taskType, taskId) {
  if (taskType === 'angle') return '05_workflow/01_angle_reference';
  if (taskType === 'ecommerce') return `05_workflow/02_ecommerce_images/${taskId}`;
  if (taskType === 'sku') return `05_workflow/03_sku_images/${taskId}`;
  throw Object.assign(new Error('Unsupported workflow task type'), { statusCode: 400 });
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
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/logo'), 'generation_assets/logo');
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/brand_refs'), 'generation_assets/brand_refs');
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/background_refs'), 'generation_assets/background_refs');
  await addExistingDir(archive, path.join(settingsDir, 'generation_assets/style_refs'), 'generation_assets/style_refs');
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

async function buildInstructionText(task) {
  return `# ChatGPT 生图素材包

任务：${task.title}
类型：${task.taskType}

使用方式：
1. 把这个压缩包拖入 ChatGPT 聊天区。
2. 复制 prompt.md 中的提示词，可按当前产品略微修改。
3. 生成图片后，回到系统把结果上传到当前任务框。

注意：
- 系统不调用 AI API。
- 请保持产品外形、包装、标签、颜色和品牌素材准确。
- 如果这是后续电商图，请参考 style_reference 中已有成品图延续风格。
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
