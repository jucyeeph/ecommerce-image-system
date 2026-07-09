import fs from 'node:fs/promises';
import path from 'node:path';
import { paths } from '../config/paths.js';
import { ensureDir, writeJson } from './fileWriter.js';
import { safeFilename } from '../utils/safeFilename.js';

const settingsFileName = 'default_prompts.json';
export const assetCategories = ['logo', 'brand_refs', 'background_refs', 'style_refs'];

export const defaultPrompts = {
  angle_reference: `# 产品角度参考图

请基于现有 main 图、detail 图、产品介绍和品牌素材，生成简单背景下的产品角度图。

要求：
- 保持产品外形、包装、瓶身、标签、颜色和材质真实准确。
- 背景尽量简单干净，方便后续 9 张电商图继续复用。
- 不要加入复杂文案，不要改变品牌信息，不要生成无关产品。
`,
  ecommerce_image_01: `# 电商图 01：主图

请基于现有原图素材、生图素材包和产品介绍，生成 1:1 电商主图。保持产品外形准确，画面高级、干净、适合 Shopee / TikTok Shop 手机端展示。
`,
  ecommerce_image_02: `# 电商图 02：核心卖点

请延续前一张电商图的视觉风格，基于产品介绍整理 2-4 个核心卖点，生成清晰、克制、移动端易读的卖点图。
`,
  ecommerce_image_03: `# 电商图 03：颜色/款式展示

请结合产品素材和已生成电商图风格，生成颜色或款式展示图。保持产品真实，不要编造不存在的 SKU。
`,
  ecommerce_image_04: `# 电商图 04：质感细节

请突出产品材质、光泽、纹理和使用质感，延续已生成电商图的风格。
`,
  ecommerce_image_05: `# 电商图 05：使用场景

请生成适合目标用户的真实使用场景图，保持产品主体准确，风格与前序电商图一致。
`,
  ecommerce_image_06: `# 电商图 06：步骤说明

请基于产品介绍生成简洁步骤说明图，文案少而清楚，适合手机端浏览。
`,
  ecommerce_image_07: `# 电商图 07：组合/套装感

请基于已有素材生成组合展示或系列感图片，不要新增不存在的产品规格。
`,
  ecommerce_image_08: `# 电商图 08：信任/细节补充

请生成补充信任信息或细节说明图，视觉风格与前序图片统一。
`,
  ecommerce_image_09: `# 电商图 09：收尾转化图

请生成适合作为详情页末尾的转化图片，保持高级干净的电商视觉风格。
`,
  sku_image: `# SKU 图

请基于对应 SKU 原图、生图素材包和产品介绍，生成统一风格的 SKU 展示图。

要求：
- SKU 颜色、瓶身、标签和色号必须准确。
- 不要改变产品外观。
- 背景、光影和构图与已生成电商图风格一致。
`
};

export async function getSettings({ dataDir = paths.dataDir } = {}) {
  const settingsDir = getSettingsDir(dataDir);
  await ensureSettingsDirs(settingsDir);
  const promptPath = path.join(settingsDir, settingsFileName);
  let prompts;
  try {
    prompts = JSON.parse(await fs.readFile(promptPath, 'utf8'));
  } catch {
    prompts = defaultPrompts;
    await writeJson(promptPath, prompts);
  }

  return {
    defaultPrompts: { ...defaultPrompts, ...prompts },
    generationAssets: await listGenerationAssets(settingsDir)
  };
}

export async function saveDefaultPrompts({ dataDir = paths.dataDir, prompts }) {
  const settingsDir = getSettingsDir(dataDir);
  await ensureSettingsDirs(settingsDir);
  const merged = { ...defaultPrompts, ...prompts };
  await writeJson(path.join(settingsDir, settingsFileName), merged);
  return getSettings({ dataDir });
}

export async function saveGenerationAsset({ dataDir = paths.dataDir, category, file }) {
  if (!assetCategories.includes(category)) {
    throw Object.assign(new Error('Unsupported asset category'), { statusCode: 400 });
  }
  const settingsDir = getSettingsDir(dataDir);
  await ensureSettingsDirs(settingsDir);
  const fileName = `${Date.now()}_${safeFilename(file.originalname || 'asset')}`;
  const target = path.join(settingsDir, 'generation_assets', category, fileName);
  await fs.copyFile(file.path, target);
  await fs.unlink(file.path).catch(() => {});
  return getSettings({ dataDir });
}

export function getSettingsDir(dataDir = paths.dataDir) {
  return path.join(dataDir, 'settings');
}

async function ensureSettingsDirs(settingsDir) {
  await ensureDir(settingsDir);
  await Promise.all(assetCategories.map((category) => ensureDir(path.join(settingsDir, 'generation_assets', category))));
}

async function listGenerationAssets(settingsDir) {
  const result = {};
  for (const category of assetCategories) {
    const dir = path.join(settingsDir, 'generation_assets', category);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    result[category] = entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        name: entry.name,
        path: path.join('settings/generation_assets', category, entry.name)
      }));
  }
  return result;
}
