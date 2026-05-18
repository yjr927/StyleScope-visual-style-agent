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

export function createFallbackReport(assets, projectGoal = '') {
  const palette = mergePalette(assets);
  const avgBrightness = average(assets.map((asset) => Number(asset.stats?.brightness || 0.6)));
  const avgSaturation = average(assets.map((asset) => Number(asset.stats?.saturation || 0.45)));
  const contrast = average(assets.map((asset) => Number(asset.stats?.contrast || 0.35)));
  const mood = avgBrightness > 0.66 ? 'luminous' : avgBrightness < 0.38 ? 'low-key' : 'balanced';
  const colorEnergy = avgSaturation > 0.58 ? 'vivid' : avgSaturation < 0.3 ? 'restrained' : 'moderate';
  const styleName = `${mood[0].toUpperCase()}${mood.slice(1)} ${colorEnergy} system`;

  return {
    demoMode: true,
    source: 'Browser signal analysis · connect an API server for OpenAI vision reasoning',
    styleName,
    summary: `The uploaded set reads as a ${mood}, ${colorEnergy} visual language. This browser-only mode uses color, contrast, dimensions, and file-level signals; a deployed API server can add semantic reasoning for objects, typography, layout genre, and finer art-direction language.`,
    confidence: Math.min(0.72, 0.42 + assets.length * 0.04 + contrast * 0.3),
    tags: [
      mood,
      colorEnergy,
      contrast > 0.48 ? 'high contrast' : 'soft contrast',
      assets.length > 8 ? 'large batch' : 'focused batch',
      projectGoal ? 'goal-aware' : 'general-purpose',
    ],
    palette,
    styleDna: [
      {
        label: 'Color behavior',
        value: `${colorEnergy} saturation with ${mood} value range`,
        evidence: `Average brightness ${avgBrightness.toFixed(2)}, saturation ${avgSaturation.toFixed(2)}.`,
      },
      {
        label: 'Contrast rhythm',
        value: contrast > 0.48 ? 'Graphic contrast' : 'Soft tonal transitions',
        evidence: `Estimated contrast score ${contrast.toFixed(2)} across ${assets.length} assets.`,
      },
      {
        label: 'Asset family',
        value: assets.length > 6 ? 'Batch-consistent visual system' : 'Small reference board',
        evidence: `${assets.length} image${assets.length === 1 ? '' : 's'} were analyzed together.`,
      },
    ],
    composition: [
      'Repeat the strongest colors consistently rather than adding new accent families.',
      'Keep subject scale and crop logic consistent across the set.',
      'Use negative space deliberately so the palette and contrast remain recognizable.',
    ],
    typography: [
      'Browser-only mode cannot reliably read typography; prefer a type treatment that visually matches the uploaded assets.',
      'Keep font weight, casing, and spacing consistent with the reference batch.',
    ],
    materials: [
      'Use the detected palette as the base material system.',
      'Preserve the same level of texture, grain, shadow, and edge sharpness visible in the source assets.',
    ],
    prompt: `Create a new visual in a ${mood}, ${colorEnergy} design style using a palette led by ${palette
      .slice(0, 5)
      .map((color) => color.hex)
      .join(', ')}. Maintain consistent crop logic, ${contrast > 0.48 ? 'strong graphic contrast' : 'soft tonal contrast'}, cohesive spacing, and a polished design-system feel. ${
      projectGoal ? `Use this goal: ${projectGoal}.` : 'Generate a fresh composition rather than copying any exact uploaded asset.'
    }`,
    negativePrompt:
      'Do not copy exact layouts, logos, characters, watermarks, or text from the references. Avoid introducing unrelated color families, inconsistent lighting, cluttered composition, low-resolution textures, and generic stock-photo styling.',
    generatorSettings: [
      'Use the palette swatches as hard constraints.',
      'Generate 3-5 variations, then choose the one with the closest contrast and saturation match.',
      'For UI assets, keep radii, stroke weights, shadows, and whitespace consistent.',
    ],
    assetNotes: assets.map((asset, index) => `${index + 1}. ${asset.name}: ${asset.stats?.width || '?'}x${asset.stats?.height || '?'} px`),
  };
}

function mergePalette(assets) {
  const colors = assets.flatMap((asset) => asset.stats?.palette || []);
  const counts = new Map();
  for (const color of colors) {
    const hex = String(color).toLowerCase();
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }

  const palette = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count], index) => ({
      hex,
      role: index === 0 ? 'Dominant base' : index < 3 ? 'Support tone' : 'Accent / detail',
      weight: Number((count / Math.max(colors.length, 1)).toFixed(2)),
    }));

  return palette.length
    ? palette
    : [
        { hex: '#f7f8fa', role: 'Base', weight: 0.4 },
        { hex: '#15181d', role: 'Text', weight: 0.25 },
        { hex: '#27c7d9', role: 'Accent', weight: 0.2 },
      ];
}
