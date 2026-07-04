import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { parseBigSellerWorkbook } from '../src/services/bigsellerParser.js';

const fixturePath = path.resolve(
  '/Users/ddqph/Documents/test/bigseller-1688-ph-listing-skill/outputs/2026-07-04_一指星河猫眼甲油胶/2026-07-04_一指星河猫眼甲油胶_bigseller_import.xlsx'
);

test('parseBigSellerWorkbook reads the supplied BigSeller template', async () => {
  const parsed = await parseBigSellerWorkbook(fixturePath);

  assert.equal(parsed.product.productName, 'JUCYEE 15ml Cat Eye Gel Nail Polish Magnetic Glass Bead Shimmer UV LED Gel for Salon Manicure');
  assert.equal(parsed.product.parentSku, 'JB0213');
  assert.equal(parsed.skus.length, 36);
  assert.equal(parsed.skus[0].sku, 'JB0213-Star touch 01');
  assert.equal(parsed.skus[0].variationOption, 'WaveBottle ST#01');
  assert.equal(parsed.imageUrls.mainImages.length, 1);
  assert.equal(parsed.imageUrls.detailImages.length, 4);
  assert.equal(parsed.imageUrls.skuImages.length, 36);
});
