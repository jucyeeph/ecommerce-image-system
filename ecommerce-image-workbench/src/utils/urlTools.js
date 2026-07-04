export function extractImageUrls(cellValue) {
  if (cellValue === null || cellValue === undefined) {
    return { urls: [], invalidUrls: [] };
  }

  const seen = new Set();
  const invalidSeen = new Set();
  const urls = [];
  const invalidUrls = [];
  const parts = String(cellValue)
    .split(/[\s,，]+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (/^https?:\/\//i.test(part)) {
      if (!seen.has(part)) {
        seen.add(part);
        urls.push(part);
      }
    } else if (!invalidSeen.has(part)) {
      invalidSeen.add(part);
      invalidUrls.push(part);
    }
  }

  return { urls, invalidUrls };
}

export function guessImageExtension(url, contentType = '') {
  const type = contentType.toLowerCase();
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(jpg|jpeg|png|webp|gif)$/);
    return match ? `.${match[1] === 'jpeg' ? 'jpg' : match[1]}` : '.jpg';
  } catch {
    return '.jpg';
  }
}
