import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getSettings, saveDefaultPrompts } from '../src/services/settingsService.js';

test('settings service creates and updates default workflow prompts', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-settings-'));
  const settings = await getSettings({ dataDir });

  assert.match(settings.defaultPrompts.angle_reference, /产品角度参考图/);
  assert.equal(settings.generationAssets.logo.length, 0);

  const updated = await saveDefaultPrompts({
    dataDir,
    prompts: {
      ecommerce_image_01: 'Image 01 custom prompt'
    }
  });

  assert.equal(updated.defaultPrompts.ecommerce_image_01, 'Image 01 custom prompt');
  assert.match(updated.defaultPrompts.sku_image, /SKU/);
});
