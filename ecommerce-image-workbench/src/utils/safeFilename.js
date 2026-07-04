export function safeFilename(value, fallback = 'untitled') {
  const cleaned = String(value || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|#%{}^~[\]`;\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

  return cleaned || fallback;
}
