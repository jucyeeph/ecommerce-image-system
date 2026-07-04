import ExcelJS from 'exceljs';
import { extractImageUrls } from '../utils/urlTools.js';

const FIELD_ALIASES = {
  productName: ['产品名称', 'product name', 'title'],
  productDescription: ['产品描述', 'description'],
  parentSku: ['parent sku', 'parent_sku'],
  category: ['分类ID', 'category'],
  brand: ['品牌', 'brand'],
  supplierUrl: ['供应商链接', 'supplier'],
  weight: ['重量', 'weight'],
  length: ['长', 'length'],
  width: ['宽', 'width'],
  height: ['高', 'height'],
  price: ['价格', 'price'],
  promoPrice: ['促销价', 'promo'],
  sku: ['sku'],
  stock: ['库存', 'stock'],
  variationName1: ['变种名称1', 'variation name1', 'variation name 1'],
  variationOption1: ['变种选项1', 'variation option1', 'variation option 1'],
  variationName2: ['变种名称2', 'variation name2', 'variation name 2'],
  variationOption2: ['变种选项2', 'variation option2', 'variation option 2'],
  variantImage: ['变种图', 'variant image']
};

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findField(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const exact = headers.find((header) => normalizedAliases.includes(normalizeHeader(header)));
  if (exact) return exact;
  return headers.find((header) => {
    const normalized = normalizeHeader(header);
    return normalizedAliases.some((alias) => normalized.includes(alias));
  });
}

function value(row, header) {
  if (!header) return '';
  const raw = row[header];
  return raw === null || raw === undefined ? '' : String(raw).trim();
}

function collectUrls(row, headers, matcher) {
  const urls = [];
  const invalidUrls = [];
  for (const header of headers.filter(matcher)) {
    const result = extractImageUrls(row[header]);
    urls.push(...result.urls);
    invalidUrls.push(...result.invalidUrls.map((url) => ({ header, url })));
  }
  return { urls: [...new Set(urls)], invalidUrls };
}

export async function parseBigSellerWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  const rows = worksheetToRows(sheet);

  if (!rows.length) {
    const error = new Error('表格为空');
    error.statusCode = 400;
    throw error;
  }

  const headers = Object.keys(rows[0]);
  const fields = Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([key, aliases]) => [key, findField(headers, aliases)])
  );
  const warnings = [];

  const first = rows[0];
  const product = {
    productName: value(first, fields.productName),
    productDescription: value(first, fields.productDescription),
    parentSku: value(first, fields.parentSku),
    category: value(first, fields.category),
    brand: value(first, fields.brand) || 'JUCYEE | BOMD',
    supplierUrl: value(first, fields.supplierUrl),
    weight: value(first, fields.weight),
    size: {
      length: value(first, fields.length),
      width: value(first, fields.width),
      height: value(first, fields.height)
    },
    price: value(first, fields.price),
    promoPrice: value(first, fields.promoPrice)
  };

  if (!product.productName) throw Object.assign(new Error('找不到产品名称'), { statusCode: 400 });
  if (!product.parentSku) throw Object.assign(new Error('找不到 Parent SKU'), { statusCode: 400 });

  for (const [key, header] of Object.entries(fields)) {
    if (!header && ['productName', 'parentSku', 'sku', 'variantImage'].includes(key)) {
      warnings.push(`未识别字段: ${key}`);
    }
  }

  const main = collectUrls(first, headers, (header) => normalizeHeader(header).includes('产品主图'));
  const detail = collectUrls(first, headers, (header) => normalizeHeader(header).includes('产品附属图'));
  const skuImages = [];
  const skuSeen = new Set();
  const skus = rows
    .map((row, index) => {
      const sku = value(row, fields.sku) || `${product.parentSku}-${index + 1}`;
      const variationOption = value(row, fields.variationOption1) || value(row, fields.variationOption2) || sku;
      const variant = extractImageUrls(value(row, fields.variantImage));
      if (skuSeen.has(sku)) warnings.push(`SKU 重复: ${sku}`);
      skuSeen.add(sku);
      if (variant.invalidUrls.length) warnings.push(`SKU ${sku} 存在无效变种图 URL: ${variant.invalidUrls.join(', ')}`);
      for (const url of variant.urls) {
        skuImages.push({ sku, variationOption, url });
      }
      return {
        sku,
        sellerSku: sku,
        variationName: value(row, fields.variationName1) || value(row, fields.variationName2),
        variationOption,
        colorName: variationOption,
        stock: value(row, fields.stock),
        skuPrice: value(row, fields.price),
        sourceImageUrl: variant.urls[0] || '',
        localImagePath: '',
        downloadStatus: 'pending'
      };
    })
    .filter((sku) => sku.sku || sku.variationOption || sku.sourceImageUrl);

  const imageUrls = {
    mainImages: main.urls,
    detailImages: detail.urls,
    skuImages
  };

  if (!main.urls.length && !detail.urls.length && !skuImages.length) {
    throw Object.assign(new Error('找不到任何图片 URL'), { statusCode: 400 });
  }

  for (const invalid of [...main.invalidUrls, ...detail.invalidUrls]) {
    warnings.push(`${invalid.header} 存在无效 URL: ${invalid.url}`);
  }

  return { product, skus, imageUrls, warnings, headers, rowCount: rows.length };
}

function worksheetToRows(sheet) {
  if (!sheet || sheet.rowCount < 2) return [];
  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = cellText(cell.value);
  });

  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const sheetRow = sheet.getRow(rowNumber);
    const row = {};
    let hasValue = false;
    for (let colNumber = 1; colNumber < headers.length; colNumber++) {
      const header = headers[colNumber];
      if (!header) continue;
      const text = cellText(sheetRow.getCell(colNumber).value);
      row[header] = text;
      if (text) hasValue = true;
    }
    if (hasValue) rows.push(row);
  }
  return rows;
}

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value.text) return String(value.text).trim();
  if (value.hyperlink) return String(value.hyperlink).trim();
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('').trim();
  if (value.result !== undefined) return cellText(value.result);
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}
