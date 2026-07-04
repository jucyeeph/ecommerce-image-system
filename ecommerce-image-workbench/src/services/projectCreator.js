import fs from 'node:fs/promises';
import path from 'node:path';
import { parseBigSellerWorkbook } from './bigsellerParser.js';
import { downloadProjectImages } from './imageDownloader.js';
import { generatePrompts } from './promptGenerator.js';
import { ensureDir, writeCsv, writeJson, writeText } from './fileWriter.js';
import { safeFilename } from '../utils/safeFilename.js';
import { normalizeSku } from '../utils/skuNormalize.js';

export async function createProjectFromImport({ sourceFilePath, projectsRoot, skipDownloads = false, now = new Date() }) {
  const parsed = await parseBigSellerWorkbook(sourceFilePath);
  const createdAt = now.toISOString();
  const date = formatDateForProject(now);
  const shortName = safeFilename(parsed.product.productName);
  const projectId = `${date}_${safeFilename(parsed.product.parentSku)}_${shortName}`;
  const projectPath = await reserveProjectPath(projectsRoot, projectId);
  const skuFileNames = new Map(parsed.skus.map((sku) => [sku.sku, normalizeSku(sku.variationOption || sku.sku)]));

  await createProjectDirs(projectPath);
  await fs.copyFile(sourceFilePath, path.join(projectPath, '00_source/original_bigseller_import.xlsx'));

  const downloadResults = await downloadProjectImages({
    imageUrls: parsed.imageUrls,
    projectPath,
    skipDownloads,
    skuFileNames
  });
  const skuResultBySku = new Map(downloadResults.filter((item) => item.type === 'sku').map((item) => [item.sku, item]));

  const skus = parsed.skus.map((sku) => {
    const result = skuResultBySku.get(sku.sku);
    return {
      ...sku,
      localImagePath: result?.local_path || '',
      downloadStatus: result?.status || 'missing'
    };
  });

  const downloadedImages = downloadResults.filter((item) => ['success', 'skipped'].includes(item.status)).length;
  const failedImages = downloadResults.filter((item) => item.status === 'failed').length;
  const statusText = failedImages ? 'completed_with_warnings' : 'completed';
  const productInfo = {
    project_name: path.basename(projectPath),
    product_name: parsed.product.productName,
    parent_sku: parsed.product.parentSku,
    brand: parsed.product.brand,
    product_type: parsed.product.productName.toLowerCase().includes('gel') ? 'Cat Eye Gel Nail Polish' : 'Ecommerce Product',
    description: parsed.product.productDescription,
    supplier_url: parsed.product.supplierUrl,
    created_at: createdAt
  };
  const importReport = {
    status: statusText,
    warnings: parsed.warnings,
    source_file: path.basename(sourceFilePath),
    parsed_rows: parsed.rowCount,
    download_results: downloadResults
  };
  const projectStatus = {
    project_id: path.basename(projectPath),
    phase: 'phase_1_imported',
    import_status: statusText,
    image_download_status: statusText,
    total_skus: skus.length,
    downloaded_images: downloadedImages,
    failed_images: failedImages,
    next_step: 'review_materials_and_generate_prompts'
  };

  await writeJson(path.join(projectPath, '00_source/product_info.json'), productInfo);
  await writeJson(path.join(projectPath, '00_source/image_urls.json'), parsed.imageUrls);
  await writeJson(path.join(projectPath, '00_source/import_report.json'), importReport);
  await writeJson(path.join(projectPath, 'project_status.json'), projectStatus);
  await writeCsv(
    path.join(projectPath, '00_source/sku_map.csv'),
    ['sku', 'variation_name', 'variation_option', 'color_name', 'source_image_url', 'local_image_path', 'download_status'],
    skus.map((sku) => ({
      sku: sku.sku,
      variation_name: sku.variationName,
      variation_option: sku.variationOption,
      color_name: sku.colorName,
      source_image_url: sku.sourceImageUrl,
      local_image_path: sku.localImagePath,
      download_status: sku.downloadStatus
    }))
  );

  const prompts = generatePrompts({
    product: parsed.product,
    skus,
    imageCounts: {
      main: parsed.imageUrls.mainImages.length,
      detail: parsed.imageUrls.detailImages.length,
      sku: parsed.imageUrls.skuImages.length
    }
  });
  for (const [fileName, content] of Object.entries(prompts)) {
    await writeText(path.join(projectPath, '02_prompts', fileName), content);
  }
  await writeText(path.join(projectPath, '04_review/review_notes.md'), '# Review Notes\n\n');

  return {
    projectId: path.basename(projectPath),
    projectPath,
    product: productInfo,
    skus,
    downloadResults,
    status: {
      totalSkus: skus.length,
      totalImages: downloadResults.length,
      downloadedImages,
      failedImages,
      status: statusText
    }
  };
}

async function reserveProjectPath(projectsRoot, projectId) {
  await ensureDir(projectsRoot);
  let candidate = path.join(projectsRoot, projectId);
  let suffix = 2;
  while (true) {
    try {
      await fs.mkdir(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      candidate = path.join(projectsRoot, `${projectId}_${suffix++}`);
    }
  }
}

async function createProjectDirs(projectPath) {
  const dirs = [
    '00_source',
    '01_downloaded_images/main',
    '01_downloaded_images/detail',
    '01_downloaded_images/sku',
    '02_prompts',
    '03_generated/main_images',
    '03_generated/detail_images',
    '03_generated/sku_images',
    '04_review/selected',
    '04_review/rejected'
  ];
  await Promise.all(dirs.map((dir) => ensureDir(path.join(projectPath, dir))));
}

function formatDateForProject(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.PROJECT_TIME_ZONE || 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
