import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { openDatabase } from '../server/db.js';
import { createProject, getProject } from '../server/services/projectService.js';
import { handleHermesZip, moveFileAcrossDevices } from '../server/services/fileService.js';

test('creates project folders and Hermes prompt from a product link', () => {
  const ctx = createTestContext();
  const project = createProject(ctx.db, {
    source_url: 'https://detail.1688.com/example.html',
    category: 'Nail Gel'
  });

  assert.equal(project.project_code.endsWith('-001'), true);
  assert.equal(project.current_stage, 'hermes_collection');
  assert.equal(fs.existsSync(path.join(project.project_path, '00_project_meta/product_link.txt')), true);
  assert.equal(fs.existsSync(path.join(project.project_path, '01_hermes_collection/hermes_prompt.md')), true);
  assert.equal(fs.existsSync(path.join(project.project_path, '02_product_cutout_material/generated_white_bg')), true);
  assert.equal(project.stages.length, 3);

  ctx.cleanup();
});

test('parses Hermes zip, writes SKUs, renames project, and prepares next prompts', () => {
  const ctx = createTestContext();
  const project = createProject(ctx.db, {
    source_url: 'https://detail.1688.com/example.html',
    category: 'Nail Gel'
  });
  const zipPath = path.join(ctx.root, 'hermes.zip');
  const zip = new AdmZip();
  zip.addFile('nested/product_intro.md', Buffer.from('# Product Introduction\n\n- Suggested Project Name: BOMD Cat Eye Gel Polish 36 Colors\n', 'utf8'));
  zip.addFile('nested/sku_info.md', Buffer.from('| SKU ID | Original Name |\n|---|---|\n', 'utf8'));
  zip.addFile('nested/sku_info.json', Buffer.from(JSON.stringify({
    sku_list: [
      { sku_id: 'SKU01', original_name: '红色', english_name: 'Red', color_or_spec: 'Red', image_file: 'SKU01.jpg' }
    ]
  }), 'utf8'));
  zip.addFile('nested/hermes_result_summary.md', Buffer.from('OK', 'utf8'));
  zip.writeZip(zipPath);

  const result = handleHermesZip(ctx.db, project.id, { path: zipPath, originalname: 'hermes.zip' });
  const updated = getProject(ctx.db, project.id);

  assert.deepEqual(result.warnings, []);
  assert.equal(updated.project_name.includes('bomd-cat-eye-gel-polish-36-colors'), true);
  assert.equal(updated.skus.length, 1);
  assert.equal(updated.stages.find((stage) => stage.stage_key === 'hermes_collection').status, 'parsed');
  assert.equal(fs.existsSync(path.join(updated.project_path, '02_product_cutout_material/prompt_extract_white_bg.md')), true);
  assert.equal(fs.existsSync(path.join(updated.project_path, '03_main_image/prompt_project.md')), true);

  ctx.cleanup();
});

test('moves uploaded files across Docker mount boundaries when rename reports EXDEV', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-workbench-exdev-'));
  const source = path.join(root, 'upload.tmp');
  const target = path.join(root, 'data', 'upload.zip');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(source, 'zip-bytes', 'utf8');

  const originalRename = fs.renameSync;
  fs.renameSync = () => {
    const error = new Error('cross-device link not permitted');
    error.code = 'EXDEV';
    throw error;
  };

  try {
    moveFileAcrossDevices(source, target);
  } finally {
    fs.renameSync = originalRename;
  }

  assert.equal(fs.existsSync(source), false);
  assert.equal(fs.readFileSync(target, 'utf8'), 'zip-bytes');
  fs.rmSync(root, { recursive: true, force: true });
});

function createTestContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-workbench-test-'));
  const previous = {
    DATA_DIR: process.env.DATA_DIR,
    PROJECTS_DIR: process.env.PROJECTS_DIR,
    DATABASE_PATH: process.env.DATABASE_PATH
  };
  process.env.DATA_DIR = path.join(root, 'data');
  process.env.PROJECTS_DIR = path.join(root, 'data/projects');
  process.env.DATABASE_PATH = path.join(root, 'data/database/workbench.sqlite');
  const db = openDatabase(process.env.DATABASE_PATH);
  return {
    root,
    db,
    cleanup() {
      db.close();
      Object.assign(process.env, previous);
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}
