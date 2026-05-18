# StyleScope Agent

A visual style identification workbench for uploading many image assets, extracting style signals, and generating prompts for similar-style visual generation.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## OpenAI Vision Analysis

The app works without an API key by using local color, contrast, and asset metrics. For deeper semantic style analysis, copy `.env.example` to `.env` and add:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
```

The server uses the OpenAI Responses API with image inputs and structured JSON output.

## What It Generates

- Style name and confidence score
- Palette swatches with roles
- Style DNA with evidence
- Composition, typography, and material rules
- Image generation prompt
- Negative prompt
- Generator settings and asset notes
