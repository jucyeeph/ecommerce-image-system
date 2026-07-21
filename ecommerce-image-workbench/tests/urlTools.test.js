import assert from 'node:assert/strict';
import test from 'node:test';
import { extractImageUrls } from '../src/utils/urlTools.js';

test('extractImageUrls trims, splits, filters invalid URLs, and deduplicates', () => {
  const result = extractImageUrls(' https://a.test/1.jpg,not-url\nhttp://b.test/2.png https://a.test/1.jpg ftp://bad.test/x ');

  assert.deepEqual(result.urls, ['https://a.test/1.jpg', 'http://b.test/2.png']);
  assert.deepEqual(result.invalidUrls, ['not-url', 'ftp://bad.test/x']);
});
