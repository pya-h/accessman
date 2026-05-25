import { useState, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { importTokens } from '@/api/import';
import type { ImportFormat, ImportMode, ImportResponse } from '@/api/import';
import { listApps } from '@/api/apps';
import { useQuery } from '@/lib/use-query';
import { showToast } from '@/components/toast';
import { FormatTemplate } from '@/components/format-template';
import styles from './import.module.css';

// In-memory state for passing import results to results page
let lastImportResult: ImportResponse | null = null;
export function getLastImportResult(): ImportResponse | null {
  const r = lastImportResult;
  lastImportResult = null;
  return r;
}

function detectFormat(content: string, fileName?: string): ImportFormat {
  if (fileName) {
    if (fileName.endsWith('.csv')) return 'csv';
    if (fileName.endsWith('.json')) return 'json';
  }
  const trimmed = content.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  return 'csv';
}

function validateContent(content: string, format: ImportFormat): string | null {
  if (!content.trim()) return 'Content is empty';
  if (format === 'json') {
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) return 'JSON must be an array';
      if (parsed.length === 0) return 'JSON array is empty';
    } catch {
      return 'Invalid JSON';
    }
  } else {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return 'CSV must have a header row and at least one data row';
  }
  return null;
}

export function ImportPage() {
  const { route } = useLocation();

  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<ImportFormat>('json');
  const [mode, setMode] = useState<ImportMode>('import');
  const [scope, setScope] = useState<'all' | 'single'>('all');
  const [appName, setAppName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: apps } = useQuery(() => listApps(), []);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const detected = detectFormat('', file.name);
    setFormat(detected);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setContent(text);
      // Re-detect from content if extension didn't give a clear answer
      setFormat(detectFormat(text, file.name));
    };
    reader.onerror = () => {
      showToast('error', 'Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleFile(file);
  };

  const handlePaste = (value: string) => {
    setContent(value);
    setFormat(detectFormat(value));
    setFileName('');
  };

  const handleSubmit = async () => {
    const error = validateContent(content, format);
    if (error) {
      showToast('error', error);
      return;
    }

    setSubmitting(true);
    try {
      const data = format === 'json' ? JSON.parse(content) : content;
      const result = await importTokens(data, format, mode, scope === 'single' ? appName : undefined);
      lastImportResult = result;
      route('/import/results');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Import failed';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class={styles.page}>
      <h2 class={styles.title}>Import Tokens</h2>

      {/* Tabs */}
      <div class={styles.tabs}>
        <button
          class={`${styles.tab} ${tab === 'paste' ? styles.tabActive : ''}`}
          onClick={() => setTab('paste')}
        >
          Paste
        </button>
        <button
          class={`${styles.tab} ${tab === 'upload' ? styles.tabActive : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload
        </button>
      </div>

      {/* Content input */}
      {tab === 'paste' ? (
        <textarea
          class={styles.textarea}
          placeholder={'Paste JSON array or CSV content here...\n\nJSON: [{"userId": "user1", "appName": "myapp"}, ...]\nCSV:\nuserId,appName\nuser1,myapp'}
          value={content}
          onInput={(e) => handlePaste((e.target as HTMLTextAreaElement).value)}
          rows={12}
        />
      ) : (
        <div
          class={styles.dropZone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            class={styles.fileInput}
            onChange={handleFileInput}
          />
          {fileName ? (
            <p class={styles.dropLabel}>{fileName}</p>
          ) : (
            <>
              <p class={styles.dropLabel}>Drop a .json or .csv file here</p>
              <p class={styles.dropHint}>or click to browse</p>
            </>
          )}
        </div>
      )}

      {/* Options */}
      <div class={styles.options}>
        <div class={styles.option}>
          <label class={styles.optionLabel}>Format</label>
          <select
            class={styles.select}
            value={format}
            onChange={(e) => setFormat((e.target as HTMLSelectElement).value as ImportFormat)}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>

        <div class={styles.option}>
          <label class={styles.optionLabel}>Mode</label>
          <select
            class={styles.select}
            value={mode}
            onChange={(e) => setMode((e.target as HTMLSelectElement).value as ImportMode)}
          >
            <option value="import">Import (new tokens)</option>
            <option value="reissue">Reissue (revoke + new)</option>
          </select>
        </div>

        <div class={styles.option}>
          <label class={styles.optionLabel}>App Scope</label>
          <select
            class={styles.select}
            value={scope}
            onChange={(e) => setScope((e.target as HTMLSelectElement).value as 'all' | 'single')}
          >
            <option value="all">All apps (per-row)</option>
            <option value="single">Single app</option>
          </select>
        </div>

        {scope === 'single' && (
          <div class={styles.option}>
            <label class={styles.optionLabel}>App Name</label>
            <select
              class={styles.select}
              value={appName}
              onChange={(e) => setAppName((e.target as HTMLSelectElement).value)}
            >
              <option value="">Select app...</option>
              {(apps || []).map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <FormatTemplate format={format} mode={mode} scope={scope} />

      <button
        class={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting || !content.trim() || (scope === 'single' && !appName)}
      >
        {submitting ? 'Importing...' : mode === 'reissue' ? 'Reissue Tokens' : 'Import Tokens'}
      </button>
    </div>
  );
}
