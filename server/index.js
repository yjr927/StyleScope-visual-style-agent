import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const app = express();
const port = Number(process.env.PORT || 8787);
const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const appBase = '/StyleScope-visual-style-agent';

app.use(cors());
app.use(express.json({ limit: '60mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    const projectGoal = String(req.body?.projectGoal || '').slice(0, 1200);

    if (!assets.length) {
      res.status(400).json({ error: 'Upload at least one image asset.' });
      return;
    }

    const safeAssets = assets
      .filter((asset) => asset?.dataUrl?.startsWith('data:image/'))
      .slice(0, 16)
      .map((asset) => ({
        name: String(asset.name || 'Untitled asset').slice(0, 160),
        type: String(asset.type || 'image').slice(0, 80),
        dataUrl: asset.dataUrl,
        stats: asset.stats || {},
      }));

    if (!safeAssets.length) {
      res.status(400).json({ error: 'No valid image files were provided.' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.json(createFallbackReport(safeAssets, projectGoal));
      return;
    }

    const report = await analyzeWithOpenAI(safeAssets, projectGoal);
    res.json({ ...report, demoMode: false, source: `OpenAI Responses API · ${model}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Style analysis failed.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

const staticOptions = {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
};

app.use(express.static(path.join(rootDir, 'dist'), staticOptions));
app.use(appBase, express.static(path.join(rootDir, 'dist'), staticOptions));
app.get(/.*/, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(rootDir, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`StyleScope API running on http://localhost:${port}`);
});

async function analyzeWithOpenAI(assets, projectGoal) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const inputContent = [
    {
      type: 'input_text',
      text: buildPrompt(assets, projectGoal),
    },
    ...assets.map((asset) => ({
      type: 'input_image',
      image_url: asset.dataUrl,
      detail: 'low',
    })),
  ];

  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'user',
        content: inputContent,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'visual_style_report',
        schema: reportSchema,
        strict: true,
      },
    },
  });

  const text = response.output_text || '{}';
  return JSON.parse(text);
}

function buildPrompt(assets, projectGoal) {
  const stats = assets.map((asset, index) => ({
    index: index + 1,
    name: asset.name,
    stats: asset.stats,
  }));

  return `You are StyleScope, an expert visual design style identification agent.

Analyze the uploaded visual assets as a set. Identify the shared design style, not just individual image contents.

Project goal from the user:
${projectGoal || 'No extra goal provided. Create broadly useful generation prompts.'}

Client-side image signals:
${JSON.stringify(stats, null, 2)}

Return only JSON that matches the schema. Be specific, designer-friendly, and practical.
The prompt fields should help the user generate new visuals in a similar style while avoiding direct copying of any specific protected logo, character, or exact composition.`;
}

const reportSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'styleName',
    'summary',
    'confidence',
    'tags',
    'palette',
    'styleDna',
    'composition',
    'typography',
    'materials',
    'prompt',
    'negativePrompt',
    'generatorSettings',
    'assetNotes',
  ],
  properties: {
    styleName: { type: 'string' },
    summary: { type: 'string' },
    confidence: { type: 'number' },
    tags: { type: 'array', items: { type: 'string' } },
    palette: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hex', 'role', 'weight'],
        properties: {
          hex: { type: 'string' },
          role: { type: 'string' },
          weight: { type: 'number' },
        },
      },
    },
    styleDna: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value', 'evidence'],
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    composition: { type: 'array', items: { type: 'string' } },
    typography: { type: 'array', items: { type: 'string' } },
    materials: { type: 'array', items: { type: 'string' } },
    prompt: { type: 'string' },
    negativePrompt: { type: 'string' },
    generatorSettings: { type: 'array', items: { type: 'string' } },
    assetNotes: { type: 'array', items: { type: 'string' } },
  },
};

function createFallbackReport(assets, projectGoal) {
  const palette = mergePalette(assets);
  const avgBrightness = average(assets.map((asset) => Number(asset.stats?.brightness || 0.6)));
  const avgSaturation = average(assets.map((asset) => Number(asset.stats?.saturation || 0.45)));
  const contrast = average(assets.map((asset) => Number(asset.stats?.contrast || 0.35)));
  const mood = avgBrightness > 0.66 ? 'luminous' : avgBrightness < 0.38 ? 'low-key' : 'balanced';
  const colorEnergy = avgSaturation > 0.58 ? 'vivid' : avgSaturation < 0.3 ? 'restrained' : 'moderate';
  const styleName = `${mood[0].toUpperCase()}${mood.slice(1)} ${colorEnergy} system`;

  return {
    demoMode: true,
    source: 'Local signal analysis · add OPENAI_API_KEY for vision reasoning',
    styleName,
    summary: `The uploaded set reads as a ${mood}, ${colorEnergy} visual language. This local mode uses color, contrast, dimensions, and file-level signals; connecting OpenAI adds semantic reasoning for objects, typography, layout genre, and finer art-direction language.`,
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
        evidence: `${assets.length} images were analyzed together.`,
      },
    ],
    composition: [
      'Repeat the strongest colors consistently rather than adding new accent families.',
      'Keep subject scale and crop logic consistent across the set.',
      'Use negative space deliberately so the palette and contrast remain recognizable.',
    ],
    typography: [
      'Local mode cannot reliably read typography; prefer a type treatment that matches the uploaded assets visually.',
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

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}
