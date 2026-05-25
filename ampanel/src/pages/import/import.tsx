import { useState, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { importTokens } from '@/api/import';
import type { ImportFormat, ImportMode, ImportResponse } from '@/api/import';
import { listApps } from '@/api/apps';
import { useQuery } from '@/lib/use-query';
import { showToast } from '@/components/toast';
import { FormatTemplate, getFields } from '@/components/format-template';
import { CodeInput } from '@/components/code-input';
import { Modal } from '@/components/modal';
import { CustomSelect } from '@/components/custom-select';
import { IconPlus, IconUpload } from '@/components/icons';
import styles from './import.module.css';

// In-memory state for passing import results to results page
let lastImportResult: ImportResponse | null = null;
export function getLastImportResult(): ImportResponse | null {
  const r = lastImportResult;
  lastImportResult = null;
  return r;
}

// --- Conversion utilities ---

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // skip the second quote of the escaped pair
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function jsonToCsv(jsonStr: string, expectedColumns?: string[]): string | null {
  try {
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const keys: string[] = expectedColumns ? [...expectedColumns] : [];
    for (const obj of arr) {
      for (const k of Object.keys(obj)) {
        if (!keys.includes(k)) keys.push(k);
      }
    }
    const header = keys.join(',');
    const rows = arr.map((obj: Record<string, unknown>) =>
      keys.map(k => {
        const v = obj[k] ?? '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    );
    return [header, ...rows].join('\n');
  } catch {
    return null;
  }
}

function csvToJson(csvStr: string): string | null {
  try {
    const lines = csvStr.trim().split('\n').filter(l => l.trim());
    if (lines.length < 1) return null;
    const headers = parseCsvLine(lines[0]);
    if (headers.length === 0 || headers.every(h => !h)) return null;
    const rows = lines.slice(1).map(line => {
      const values = parseCsvLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const v = values[i];
        if (v !== undefined && v !== '') obj[h] = v;
      });
      return obj;
    });
    return JSON.stringify(rows, null, 2);
  } catch {
    return null;
  }
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
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [rowForm, setRowForm] = useState<Record<string, string>>({});
  const [misformatOpen, setMisformatOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: apps } = useQuery(() => listApps(), []);

  const fields = getFields(scope, mode);

  const showMisformatWarning = (onReset: () => void) => {
    setPendingAction(() => onReset);
    setMisformatOpen(true);
  };

  const handleMisformatReset = () => {
    setContent('');
    pendingAction?.();
    setMisformatOpen(false);
    setPendingAction(null);
  };

  const handleMisformatDismiss = () => {
    setMisformatOpen(false);
    setPendingAction(null);
  };

  const handleFormatChange = (newFormat: ImportFormat) => {
    if (newFormat === format) return;

    if (content.trim()) {
      let converted: string | null = null;
      if (format === 'json' && newFormat === 'csv') {
        converted = jsonToCsv(content, fields.map(f => f.name));
      } else if (format === 'csv' && newFormat === 'json') {
        converted = csvToJson(content);
      }
      if (converted !== null) {
        setContent(converted);
        setFormat(newFormat);
        showToast('success', `Converted to ${newFormat.toUpperCase()}`);
        return;
      }
      // Conversion failed — content is misformatted
      showMisformatWarning(() => setFormat(newFormat));
      return;
    }
    setFormat(newFormat);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const detected = detectFormat('', file.name);
    setFormat(detected);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setContent(text);
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
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFile(file);
    input.value = ''; // reset so re-uploading the same file triggers onChange
  };

  const handleAddRow = () => {
    setRowForm({});
    setAddRowOpen(true);
  };

  const appendRow = (row: Record<string, string>) => {
    if (format === 'json') {
      try {
        const arr = JSON.parse(content);
        if (Array.isArray(arr)) {
          arr.push(row);
          setContent(JSON.stringify(arr, null, 2));
          return true;
        }
      } catch {
        // misformatted
      }
      return false;
    } else {
      const fieldNames = fields.map(f => f.name);
      if (!content.trim()) {
        const header = fieldNames.join(',');
        const values = fieldNames.map(f => row[f] || '').join(',');
        setContent(`${header}\n${values}`);
        return true;
      }
      const lines = content.trim().split('\n');
      if (lines.length < 1) return false;
      const headers = parseCsvLine(lines[0]);
      if (headers.length === 0 || headers.every(h => !h)) return false;
      const values = headers.map(h => row[h] || '').join(',');
      setContent(`${content.trimEnd()}\n${values}`);
      return true;
    }
  };

  const handleAddRowSubmit = () => {
    const cleanRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(rowForm)) {
      if (v) cleanRow[k] = v;
    }

    if (!content.trim() || appendRow(cleanRow)) {
      setAddRowOpen(false);
      setRowForm({});
      setTab('paste');
      return;
    }

    // Content is misformatted — show warning
    setAddRowOpen(false);
    showMisformatWarning(() => {
      const freshContent = format === 'json'
        ? JSON.stringify([cleanRow], null, 2)
        : `${fields.map(f => f.name).join(',')}\n${fields.map(f => cleanRow[f.name] || '').join(',')}`;
      setContent(freshContent);
      setRowForm({});
      setTab('paste');
    });
  };

  const handleSubmit = async () => {
    const error = validateContent(content, format);
    if (error) {
      showToast('error', error);
      return;
    }

    setSubmitting(true);
    try {
      let data: string | unknown[] = format === 'json' ? JSON.parse(content) : content;
      let sendFormat: ImportFormat = format;

      // POST /import/reissue requires appName per item, but single-app scope
      // omits it from the input template — inject it before sending
      if (mode === 'reissue' && scope === 'single' && appName) {
        if (typeof data === 'string') {
          const jsonStr = csvToJson(data);
          if (!jsonStr) {
            showToast('error', 'Failed to parse CSV data');
            return;
          }
          data = JSON.parse(jsonStr);
          sendFormat = 'json';
        }
        data = (data as Record<string, unknown>[]).map(item => ({ ...item, appName }));
      }

      const result = await importTokens(data, sendFormat, mode, scope === 'single' ? appName : undefined);
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

      {/* Tabs row with format toggle */}
      <div class={styles.tabRow}>
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

        <div class={styles.formatToggle}>
          <button
            class={`${styles.formatBtn} ${format === 'json' ? styles.formatBtnActive : ''}`}
            onClick={() => handleFormatChange('json')}
          >
            JSON
          </button>
          <button
            class={`${styles.formatBtn} ${format === 'csv' ? styles.formatBtnActive : ''}`}
            onClick={() => handleFormatChange('csv')}
          >
            CSV
          </button>
        </div>
      </div>

      {/* Content input */}
      {tab === 'paste' ? (
        <CodeInput
          value={content}
          onInput={(v) => { setContent(v); setFileName(''); }}
          placeholder={format === 'json'
            ? 'Paste JSON array here...\n\n[\n  { "userId": "user1", "appName": "myapp" }\n]'
            : 'Paste CSV content here...\n\nuserId,appName\nuser1,myapp'}
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
          <div class={styles.dropIcon}>
            <IconUpload size={24} />
          </div>
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
          <label class={styles.optionLabel}>Mode</label>
          <CustomSelect
            fullWidth
            value={mode}
            options={[
              { value: 'import', label: 'Import (new tokens)' },
              { value: 'reissue', label: 'Reissue (revoke + new)' },
            ]}
            onChange={(v) => setMode(v as ImportMode)}
          />
        </div>

        <div class={styles.option}>
          <label class={styles.optionLabel}>App Scope</label>
          <CustomSelect
            fullWidth
            value={scope}
            options={[
              { value: 'all', label: 'All apps (per-row)' },
              { value: 'single', label: 'Single app' },
            ]}
            onChange={(v) => setScope(v as 'all' | 'single')}
          />
        </div>

        {scope === 'single' && (
          <div class={styles.option}>
            <label class={styles.optionLabel}>App Name</label>
            <CustomSelect
              fullWidth
              value={appName}
              options={[
                { value: '', label: 'Select app...' },
                ...(apps || []).map((a) => ({ value: a.name, label: a.name })),
              ]}
              onChange={setAppName}
            />
          </div>
        )}
      </div>

      <FormatTemplate format={format} mode={mode} scope={scope} />

      <div class={styles.buttonRow}>
        <button class={styles.addRowBtn} onClick={handleAddRow} type="button">
          <IconPlus size={14} /> Add Row
        </button>
        <button
          class={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting || !content.trim() || (scope === 'single' && !appName)}
        >
          {submitting ? 'Importing...' : mode === 'reissue' ? 'Reissue Tokens' : 'Import Tokens'}
        </button>
      </div>

      {/* Add Row Modal */}
      <Modal
        open={addRowOpen}
        onClose={() => setAddRowOpen(false)}
        title="Add Row"
        actions={
          <>
            <button class={styles.cancelBtn} onClick={() => setAddRowOpen(false)}>
              Cancel
            </button>
            <button class={styles.addBtn} onClick={handleAddRowSubmit}>
              Add
            </button>
          </>
        }
      >
        <div class={styles.modalFields}>
          {fields.map((f) => (
            <label key={f.name} class={styles.modalField}>
              <span class={styles.modalLabel}>
                {f.name}
                {f.required && <span class={styles.modalRequired}> *</span>}
              </span>
              <input
                type="text"
                class={styles.modalInput}
                placeholder={f.example}
                value={rowForm[f.name] || ''}
                onInput={(e) =>
                  setRowForm({ ...rowForm, [f.name]: (e.target as HTMLInputElement).value })
                }
              />
              <span class={styles.modalHint}>{f.note}</span>
            </label>
          ))}
        </div>
      </Modal>

      {/* Misformat Warning Modal */}
      <Modal
        open={misformatOpen}
        onClose={handleMisformatDismiss}
        title="Misformatted Data"
        actions={
          <>
            <button class={styles.cancelBtn} onClick={handleMisformatDismiss}>
              Dismiss
            </button>
            <button class={styles.resetBtn} onClick={handleMisformatReset}>
              Reset
            </button>
          </>
        }
      >
        <p class={styles.misformatText}>
          The current input data is misformatted and cannot be parsed as valid {format.toUpperCase()}.
        </p>
        <p class={styles.misformatHint}>
          You can <strong>dismiss</strong> to keep editing, or <strong>reset</strong> to clear the content and proceed.
        </p>
      </Modal>
    </div>
  );
}
