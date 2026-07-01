import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

export function extractZip(zipPath, destination) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destination, true);
}

export function findFileDeep(root, fileName) {
  return findFilesDeep(root, fileName)[0] || null;
}

export function findFilesDeep(root, fileName) {
  const matches = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) matches.push(fullPath);
    }
  }
  return matches;
}

export function copyIfFound(root, fileName, targetPath) {
  const candidates = findFilesDeep(root, fileName);
  const found = candidates.find((candidate) => path.resolve(candidate) !== path.resolve(targetPath)) || candidates[0];
  if (!found) return null;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (path.resolve(found) !== path.resolve(targetPath)) fs.copyFileSync(found, targetPath);
  return targetPath;
}

export function parseSuggestedProjectName(markdown) {
  const match = markdown.match(/-\s*Suggested Project Name:\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

export function parseSkuJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed.sku_list) ? parsed.sku_list : [];
}
