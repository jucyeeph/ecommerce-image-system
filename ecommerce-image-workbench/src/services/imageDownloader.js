import fs from 'node:fs/promises';
import path from 'node:path';
import { guessImageExtension } from '../utils/urlTools.js';
import { ensureDir } from './fileWriter.js';

export async function downloadImage({ url, outputPath, timeoutMs = 20000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type') || '';
    const bytes = Buffer.from(await response.arrayBuffer());
    const ext = path.extname(outputPath) || guessImageExtension(url, contentType);
    const finalPath = path.extname(outputPath) ? outputPath : `${outputPath}${ext}`;
    await ensureDir(path.dirname(finalPath));
    await fs.writeFile(finalPath, bytes);
    return { status: 'success', localPath: finalPath, error: null };
  } catch (error) {
    return { status: 'failed', localPath: null, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadProjectImages({ imageUrls, projectPath, skipDownloads = false, skuFileNames }) {
  const results = [];

  async function record(item) {
    if (skipDownloads) {
      results.push({ ...item, local_path: item.local_path, status: 'skipped', error: null });
      return;
    }
    const absoluteTarget = path.join(projectPath, item.local_path);
    const downloaded = await downloadImage({ url: item.url, outputPath: absoluteTarget });
    results.push({
      ...item,
      local_path: downloaded.localPath ? path.relative(projectPath, downloaded.localPath) : null,
      status: downloaded.status,
      error: downloaded.error
    });
  }

  let mainIndex = 1;
  for (const url of imageUrls.mainImages) {
    await record({
      url,
      type: 'main',
      sku: null,
      local_path: `01_downloaded_images/main/main_${String(mainIndex++).padStart(2, '0')}.jpg`
    });
  }

  let detailIndex = 1;
  for (const url of imageUrls.detailImages) {
    await record({
      url,
      type: 'detail',
      sku: null,
      local_path: `01_downloaded_images/detail/detail_${String(detailIndex++).padStart(2, '0')}.jpg`
    });
  }

  for (const item of imageUrls.skuImages) {
    const name = skuFileNames.get(item.sku) || item.variationOption || item.sku;
    await record({
      url: item.url,
      type: 'sku',
      sku: item.sku,
      local_path: `01_downloaded_images/sku/${name}.jpg`
    });
  }

  return results;
}
