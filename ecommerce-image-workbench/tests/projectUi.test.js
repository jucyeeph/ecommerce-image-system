import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const projectJsPath = path.resolve('public/js/project.js');
const stylePath = path.resolve('public/css/style.css');

test('phase 2 project UI uses a focused workflow workspace layout', async () => {
  const projectJs = await fs.readFile(projectJsPath, 'utf8');
  const css = await fs.readFile(stylePath, 'utf8');

  assert.match(projectJs, /workflow-workspace/);
  assert.match(projectJs, /workflow-steps/);
  assert.match(projectJs, /active-task-panel/);
  assert.match(projectJs, /reference-rail/);
  assert.match(projectJs, /data-reference-upload="angle"/);
  assert.match(projectJs, /data-reference-upload="style"/);
  assert.match(projectJs, /素材包/);
  assert.doesNotMatch(projectJs, /task-grid/);

  assert.match(css, /\.workflow-workspace/);
  assert.match(css, /\.active-task-panel/);
  assert.match(css, /\.reference-rail/);
});
