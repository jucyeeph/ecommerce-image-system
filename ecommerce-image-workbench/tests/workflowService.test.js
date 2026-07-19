import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProjectFromImport } from '../src/services/projectCreator.js';
import { buildTaskPackage, ensureProjectWorkflow, saveReferenceUpload, saveTaskPrompt } from '../src/services/workflowService.js';

const fixturePath = path.resolve(
  '/Users/ddqph/Documents/test/bigseller-1688-ph-listing-skill/outputs/2026-07-04_一指星河猫眼甲油胶/2026-07-04_一指星河猫眼甲油胶_bigseller_import.xlsx'
);

test('workflow service initializes angle, ecommerce, and sku tasks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-workflow-'));
  const project = await createProjectFromImport({
    sourceFilePath: fixturePath,
    projectsRoot: path.join(root, 'projects'),
    skipDownloads: true,
    now: new Date('2026-07-09T10:00:00+08:00')
  });

  const workflow = await ensureProjectWorkflow({
    projectPath: project.projectPath,
    dataDir: path.join(root, 'data')
  });

  assert.equal(workflow.angleReference.taskId, 'angle_reference');
  assert.equal(workflow.ecommerceImages.length, 9);
  assert.equal(workflow.skuImages.length, 36);
  assert.equal(workflow.ecommerceImages[0].status, 'not_started');
  await fs.access(path.join(project.projectPath, '05_workflow/02_ecommerce_images/image_01/prompt.md'));
});

test('workflow service saves prompts and builds a ChatGPT package zip', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-package-'));
  const project = await createProjectFromImport({
    sourceFilePath: fixturePath,
    projectsRoot: path.join(root, 'projects'),
    skipDownloads: true,
    now: new Date('2026-07-09T10:00:00+08:00')
  });

  await ensureProjectWorkflow({ projectPath: project.projectPath, dataDir: path.join(root, 'data') });
  const task = await saveTaskPrompt({
    projectPath: project.projectPath,
    taskType: 'ecommerce',
    taskId: 'image_01',
    prompt: 'Custom ecommerce prompt'
  });
  const zipPath = await buildTaskPackage({
    projectPath: project.projectPath,
    dataDir: path.join(root, 'data'),
    taskType: 'ecommerce',
    taskId: 'image_01'
  });

  assert.equal(task.promptEdited, true);
  assert.equal(path.basename(zipPath), 'input_package.zip');
  const bytes = await fs.readFile(zipPath);
  const zipText = bytes.toString('latin1');
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  assert.match(zipText, /prompt\.md/);
  assert.match(zipText, /product_brief\.md/);
  assert.doesNotMatch(zipText, /README_FOR_CHATGPT\.md/);
  assert.doesNotMatch(zipText, /image_urls\.json/);
  assert.doesNotMatch(zipText, /product_info\.json/);
});

test('workflow service stores project reference uploads and includes them in packages', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-reference-'));
  const project = await createProjectFromImport({
    sourceFilePath: fixturePath,
    projectsRoot: path.join(root, 'projects'),
    skipDownloads: true,
    now: new Date('2026-07-09T10:00:00+08:00')
  });
  const uploadSource = path.join(root, 'angle-ref.jpg');
  await fs.writeFile(uploadSource, 'fake image');

  const workflow = await saveReferenceUpload({
    projectPath: project.projectPath,
    referenceType: 'angle',
    file: {
      path: uploadSource,
      originalname: 'angle-ref.jpg'
    }
  });

  assert.equal(workflow.projectReferences.angle.length, 1);
  await fs.access(path.join(project.projectPath, workflow.projectReferences.angle[0].path));

  const styleSource = path.join(root, 'style-ref.jpg');
  await fs.writeFile(styleSource, 'fake style image');
  const updated = await saveReferenceUpload({
    projectPath: project.projectPath,
    referenceType: 'style',
    file: {
      path: styleSource,
      originalname: 'style-ref.jpg'
    }
  });
  assert.equal(updated.projectReferences.style.length, 1);

  const zipPath = await buildTaskPackage({
    projectPath: project.projectPath,
    dataDir: path.join(root, 'data'),
    taskType: 'ecommerce',
    taskId: 'image_01'
  });
  const zipText = (await fs.readFile(zipPath)).toString('latin1');
  assert.match(zipText, /generated_materials\/angle_reference\/.*angle-ref\.jpg/);
  assert.match(zipText, /style_reference\/project\/.*style-ref\.jpg/);
});
