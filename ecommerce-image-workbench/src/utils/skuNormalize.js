import { safeFilename } from './safeFilename.js';

export function normalizeSku(value, fallback = 'SKU') {
  return safeFilename(value, fallback).replace(/\s+/g, '_');
}
