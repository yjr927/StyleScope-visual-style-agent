import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  BrainCircuit,
  Check,
  Copy,
  FileImage,
  ImagePlus,
  Layers3,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import { createFallbackReport, formatBytes, prepareFiles } from './styleAnalyzer.js';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const apiBase = configuredApiBase || (isLocalHost ? '' : null);

const emptyReport = {
  styleName: 'Awaiting source board',
  summary: 'Upload a set of visuals to extract style DNA, palette behavior, composition rules, and reusable generation prompts.',
  confidence: 0,
  tags: ['upload assets', 'analyze style', 'generate prompt'],
  palette: [
    { hex: '#f7f8fa', role: 'Canvas', weight: 0.4 },
    { hex: '#15181d', role: 'Ink', weight: 0.3 },
    { hex: '#24c8db', role: 'Signal', weight: 0.2 },
    { hex: '#ff7a59', role: 'Accent', weight: 0.1 },
  ],
  styleDna: [],
  composition: [],
  typography: [],
  materials: [],
  prompt: '',
  negativePrompt: '',
  generatorSettings: [],
  assetNotes: [],
};

function App() {
  const [assets, setAssets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(emptyReport);
  const [projectGoal, setProjectGoal] = useState('');
  const [activeTab, setActiveTab] = useState('report');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedId) || assets[0],
    [assets, selectedId],
  );

  const combinedPalette = useMemo(() => {
    const unique = new Set();
    assets.forEach((asset) => asset.stats.palette.forEach((hex) => unique.add(hex)));
    return [...unique].slice(0, 12);
  }, [assets]);

  async function addFiles(fileList) {
    const { prepared, skipped } = await prepareFiles(fileList);
    setAssets((current) => {
      const next = [...current, ...prepared].slice(0, 24);
      if (!selectedId && next[0]) setSelectedId(next[0].id);
      return next;
    });
    setNotice(skipped.length ? skipped.join(' | ') : prepared.length ? `${prepared.length} asset${prepared.length === 1 ? '' : 's'} added` : '');
  }

  async function analyze() {
    if (!assets.length) return;
    setIsAnalyzing(true);
    setNotice('');

    try {
      if (!apiBase) {
        const payload = createFallbackReport(assets, projectGoal);
        setReport(payload);
        setActiveTab('report');
        setNotice('Browser-only report generated. Deploy an API server for OpenAI vision analysis.');
        return;
      }

      const response = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectGoal,
          assets: assets.map(({ name, type, dataUrl, stats }) => ({ name, type, dataUrl, stats })),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Analysis API did not return JSON');
      }

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Analysis failed');
      setReport(payload);
      setActiveTab('report');
      setNotice(payload.demoMode ? 'Local demo report generated. Add OPENAI_API_KEY for deeper visual reasoning.' : 'AI style report generated');
    } catch (error) {
      const payload = createFallbackReport(assets, projectGoal);
      setReport(payload);
      setActiveTab('report');
      setNotice(
        apiBase
          ? 'API unavailable, so a browser-only report was generated instead.'
          : 'Browser-only report generated. Deploy an API server for OpenAI vision analysis.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function removeAsset(id) {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function clearAll() {
    setAssets([]);
    setSelectedId(null);
    setReport(emptyReport);
    setNotice('');
  }

  async function copyText(kind, text) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(''), 1300);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <BrainCircuit size={21} />
          </div>
          <div>
            <h1>StyleScope</h1>
            <p>visual style agent</p>
          </div>
        </div>

        <label
          className={`drop-zone ${isDragging ? 'is-dragging' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <input type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files)} />
          <UploadCloud size={30} />
          <strong>Drop visual assets</strong>
          <span>PNG, JPG, WebP, GIF</span>
        </label>

        <div className="goal-block">
          <label htmlFor="goal">generation goal</label>
          <textarea
            id="goal"
            value={projectGoal}
            onChange={(event) => setProjectGoal(event.target.value)}
            placeholder="example: create campaign posters, UI moodboards, or product visuals in the same style"
          />
        </div>

        <div className="sidebar-actions">
          <button className="primary-action" type="button" onClick={analyze} disabled={!assets.length || isAnalyzing}>
            {isAnalyzing ? <Loader2 className="spin" size={17} /> : <WandSparkles size={17} />}
            Analyze
          </button>
          <button className="icon-action" type="button" onClick={clearAll} aria-label="Clear all assets" title="Clear all assets">
            <Trash2 size={17} />
          </button>
        </div>

        {notice ? <p className="notice">{notice}</p> : null}

        <div className="asset-queue">
          <div className="section-title">
            <span>Assets</span>
            <small>{assets.length}/24</small>
          </div>
          {assets.length ? (
            assets.map((asset) => (
              <button
                className={`queue-item ${selectedAsset?.id === asset.id ? 'is-selected' : ''}`}
                key={asset.id}
                type="button"
                onClick={() => setSelectedId(asset.id)}
              >
                <img src={asset.dataUrl} alt="" />
                <span>
                  <strong>{asset.name}</strong>
                  <small>
                    {asset.stats.width}x{asset.stats.height} · {formatBytes(asset.size)}
                  </small>
                </span>
                <X size={16} onClick={(event) => {
                  event.stopPropagation();
                  removeAsset(asset.id);
                }} />
              </button>
            ))
          ) : (
            <div className="empty-queue">
              <FileImage size={20} />
              <span>No assets yet</span>
            </div>
          )}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p>style board</p>
            <h2>{assets.length ? `${assets.length} reference asset${assets.length === 1 ? '' : 's'}` : 'Build a reference board'}</h2>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={analyze} disabled={!assets.length || isAnalyzing}>
              {isAnalyzing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
              Run analysis
            </button>
            <button type="button" onClick={() => document.querySelector('.drop-zone input')?.click()}>
              <ImagePlus size={16} />
              Add
            </button>
          </div>
        </header>

        <section className="canvas-area">
          <div className="asset-grid" aria-label="Uploaded asset board">
            {assets.length ? (
              assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`asset-tile ${selectedAsset?.id === asset.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <img src={asset.dataUrl} alt={asset.name} />
                  <span>{asset.name}</span>
                </button>
              ))
            ) : (
              <div className="empty-board">
                <div className="empty-orbit">
                  <Sparkles size={32} />
                </div>
                <h3>Upload a style family</h3>
                <p>Use screenshots, posters, brand boards, product renders, social graphics, or UI captures.</p>
              </div>
            )}
          </div>

          <div className="signal-panel">
            <div className="section-title">
              <span>Signal extraction</span>
              <small>{selectedAsset ? selectedAsset.name : 'waiting'}</small>
            </div>
            {selectedAsset ? (
              <>
                <div className="preview-strip">
                  <img src={selectedAsset.dataUrl} alt={selectedAsset.name} />
                  <div>
                    <h3>{selectedAsset.name}</h3>
                    <p>
                      {selectedAsset.stats.width}x{selectedAsset.stats.height} · ratio {selectedAsset.stats.aspectRatio}
                    </p>
                  </div>
                </div>
                <div className="metrics-grid">
                  <Metric label="brightness" value={selectedAsset.stats.brightness} />
                  <Metric label="saturation" value={selectedAsset.stats.saturation} />
                  <Metric label="contrast" value={selectedAsset.stats.contrast} />
                </div>
              </>
            ) : (
              <div className="signal-empty">Select an asset to inspect source signals.</div>
            )}
            <div className="swatch-row">
              {(combinedPalette.length ? combinedPalette : emptyReport.palette.map((color) => color.hex)).map((hex) => (
                <span key={hex} style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <aside className="inspector">
        <div className="inspector-head">
          <div>
            <p>analysis result</p>
            <h2>{report.styleName}</h2>
          </div>
          <div className="confidence">
            <span>{Math.round((report.confidence || 0) * 100)}%</span>
            <small>confidence</small>
          </div>
        </div>

        <div className="tabs" role="tablist">
          <button className={activeTab === 'report' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('report')}>
            <Layers3 size={15} />
            Report
          </button>
          <button className={activeTab === 'prompt' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('prompt')}>
            <Sparkles size={15} />
            Prompt
          </button>
        </div>

        {activeTab === 'report' ? (
          <ReportView report={report} />
        ) : (
          <PromptView report={report} copied={copied} onCopy={copyText} />
        )}
      </aside>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <div>
        <i style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <strong>{value.toFixed(2)}</strong>
    </div>
  );
}

function ReportView({ report }) {
  return (
    <div className="inspector-scroll">
      <p className="summary">{report.summary}</p>

      <div className="tag-row">
        {report.tags?.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <Panel title="Palette" icon={<Palette size={16} />}>
        <div className="palette-list">
          {report.palette?.map((color) => (
            <div className="palette-item" key={`${color.hex}-${color.role}`}>
              <span style={{ backgroundColor: color.hex }} />
              <strong>{color.hex}</strong>
              <small>{color.role}</small>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Style DNA" icon={<BrainCircuit size={16} />}>
        <div className="dna-list">
          {report.styleDna?.length ? (
            report.styleDna.map((item) => (
              <article key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                <p>{item.evidence}</p>
              </article>
            ))
          ) : (
            <p className="muted">Run analysis to populate visual DNA.</p>
          )}
        </div>
      </Panel>

      <Panel title="Rules" icon={<Check size={16} />}>
        <RuleList title="Composition" items={report.composition} />
        <RuleList title="Typography" items={report.typography} />
        <RuleList title="Materials" items={report.materials} />
      </Panel>
    </div>
  );
}

function PromptView({ report, copied, onCopy }) {
  return (
    <div className="inspector-scroll">
      <Panel title="Generation prompt" icon={<WandSparkles size={16} />}>
        <PromptBlock text={report.prompt || 'Run analysis to generate a reusable style prompt.'} />
        <button className="copy-button" type="button" onClick={() => onCopy('prompt', report.prompt)}>
          {copied === 'prompt' ? <Check size={16} /> : <Copy size={16} />}
          {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
        </button>
      </Panel>

      <Panel title="Negative prompt" icon={<X size={16} />}>
        <PromptBlock text={report.negativePrompt || 'Negative prompt appears after analysis.'} />
        <button className="copy-button" type="button" onClick={() => onCopy('negative', report.negativePrompt)}>
          {copied === 'negative' ? <Check size={16} /> : <Copy size={16} />}
          {copied === 'negative' ? 'Copied' : 'Copy negative'}
        </button>
      </Panel>

      <Panel title="Generator settings" icon={<ArrowDownToLine size={16} />}>
        <RuleList items={report.generatorSettings} />
      </Panel>

      <Panel title="Asset notes" icon={<FileImage size={16} />}>
        <RuleList items={report.assetNotes} />
      </Panel>
    </div>
  );
}

function PromptBlock({ text }) {
  return <pre className="prompt-block">{text}</pre>;
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <div className="panel-title">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function RuleList({ title, items = [] }) {
  return (
    <div className="rule-list">
      {title ? <strong>{title}</strong> : null}
      {items?.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Waiting for analysis.</p>
      )}
    </div>
  );
}

export default App;
