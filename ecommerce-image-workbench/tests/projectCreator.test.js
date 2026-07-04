import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProjectFromImport } from '../src/services/projectCreator.js';

const fixturePath = path.resolve(
  '/Users/ddqph/Documents/test/bigseller-1688-ph-listing-skill/outputs/2026-07-04_一指星河猫眼甲油胶/2026-07-04_一指星河猫眼甲油胶_bigseller_import.xlsx'
);

test('createProjectFromImport writes the phase 1 project package', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-project-'));
  const project = await createProjectFromImport({
    sourceFilePath: fixturePath,
    projectsRoot: root,
    skipDownloads: true,
    now: new Date('2026-07-04T00:00:00+08:00')
  });

  assert.match(project.projectId, /^2026-07-04_JB0213_/);
  assert.equal(project.status.totalSkus, 36);
  assert.equal(project.status.failedImages, 0);

  const requiredFiles = [
    '00_source/original_bigseller_import.xlsx',
    '00_source/product_info.json',
    '00_source/sku_map.csv',
    '00_source/image_urls.json',
    '00_source/import_report.json',
    '02_prompts/image_01_main_prompt.md',
    '02_prompts/image_02_selling_points_prompt.md',
    '02_prompts/image_03_color_chart_prompt.md',
    '02_prompts/sku_image_prompt_template.md',
    '02_prompts/project_prompt_brief.md',
    'project_status.json'
  ];

  for (const file of requiredFiles) {
    await fs.access(path.join(project.projectPath, file));
  }
});
