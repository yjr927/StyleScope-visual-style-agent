const MAX_ASSETS = 24;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function prepareFiles(fileList) {
  const files = [...fileList]
    .filter((file) => file.type.startsWith('image/'))
    .slice(0, MAX_ASSETS);

  const prepared = [];
  const skipped = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      skipped.push(`${file.name} is larger than 8 MB`);
      continue;
    }

    const dataUrl = await readAsDataUrl(file);
    const stats = await extractImageStats(dataUrl);
    prepared.push({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
      stats,
    });
  }

  return { prepared, skipped };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function extractImageStats(dataUrl) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const sampleSize = 96;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, sampleSize, sampleSize);
  const pixels = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

  const buckets = new Map();
  const lumaValues = [];
  let saturationTotal = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 24) continue;

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const { s } = rgbToHsl(r, g, b);
    const key = quantizedHex(r, g, b);

    buckets.set(key, (buckets.get(key) || 0) + 1);
    lumaValues.push(luma);
    saturationTotal += s;
    count += 1;
  }

  const brightness = average(lumaValues);
  const contrast = standardDeviation(lumaValues, brightness);
  const saturation = count ? saturationTotal / count : 0;

  const palette = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => hex);

  return {
    width,
    height,
    aspectRatio: Number((width / Math.max(height, 1)).toFixed(2)),
    brightness: Number(brightness.toFixed(3)),
    saturation: Number(saturation.toFixed(3)),
    contrast: Number(contrast.toFixed(3)),
    palette,
  };
}

function quantizedHex(r, g, b) {
  const q = (value) => Math.min(255, Math.max(0, Math.round(value / 32) * 32));
  return rgbToHex(q(r), q(g), q(b));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }

  return { h, s, l };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values, mean) {
  if (!values.length) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** order).toFixed(order ? 1 : 0)} ${units[order]}`;
}
