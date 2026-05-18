# StyleScope Agent

A visual style identification workbench for uploading many image assets, extracting style signals, and generating prompts for similar-style visual generation.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## OpenAI Vision Analysis

The app works without an API key by using local color, contrast, and asset metrics. GitHub Pages is static hosting, so the public Pages site uses this browser-only analysis by default.

For deeper semantic OpenAI vision analysis, deploy the Node server somewhere that can safely hold secrets. Do not put `OPENAI_API_KEY` directly in browser code. On the server, copy `.env.example` to `.env` and add:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
```

Then point the frontend at that deployed API by setting:

```bash
VITE_API_BASE_URL=https://your-api.example.com
```

The server uses the OpenAI Responses API with image inputs and structured JSON output. On `localhost`, the Vite dev server proxies `/api` to `http://localhost:8787`.

## What It Generates

- Style name and confidence score
- Palette swatches with roles
- Style DNA with evidence
- Composition, typography, and material rules
- Image generation prompt
- Negative prompt
- Generator settings and asset notes
