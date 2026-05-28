import { useState } from 'preact/hooks';
import type { ImportFormat, ImportMode } from '@/api/import';
import { IconCopy, IconCheck } from '@/components/icons';
import styles from './format-template.module.css';

interface FormatTemplateProps {
  format: ImportFormat;
  mode: ImportMode;
  scope: 'all' | 'single';
}

export interface FieldDef {
  name: string;
  required: boolean;
  example: string;
  note: string;
}

export function getFields(scope: 'all' | 'single', mode: ImportMode): FieldDef[] {
  const fields: FieldDef[] = [
    {
      name: 'userId',
      required: mode === 'reissue',
      example: 'user-123',
      note: mode === 'reissue'
        ? 'required for reissue'
        : 'optional — auto-generated UUID if omitted',
    },
  ];
  if (scope === 'all') {
    fields.push({
      name: 'appName',
      required: true,
      example: 'myapp',
      note: 'registered or auto-created',
    });
  }
  fields.push(
    {
      name: 'expiresAt',
      required: false,
      example: '2027-12-31T23:59:59Z',
      note: 'ISO 8601 date — no expiry if omitted',
    },
    {
      name: 'token',
      required: false,
      example: 'MyCustomCode01',
      note: 'auto-generated if omitted. Custom code: 4–64 chars (no app prefix needed)',
    },
  );
  return fields;
}

function buildTemplateText(format: ImportFormat, fields: FieldDef[]): string {
  if (format === 'json') {
    const obj: Record<string, string> = {};
    for (const f of fields) obj[f.name] = f.example;
    return JSON.stringify([obj], null, 2);
  }
  const header = fields.map(f => f.name).join(',');
  const row = fields.map(f => f.example).join(',');
  return `${header}\n${row}`;
}

function JsonTemplate({ fields }: { fields: FieldDef[] }) {
  return (
    <div class={styles.code}>
      {'[\n  {\n'}
      {fields.map((f, i) => (
        <span key={f.name}>
          {'    '}<span class={styles.key}>"{f.name}"</span>: <span class={styles.str}>"{f.example}"</span>
          {i < fields.length - 1 ? ',' : ''}
          {' '}
          <span class={f.required ? styles.comment : `${styles.comment} ${styles.optional}`}>
            {'// '}{f.required ? <><span class={styles.required}>*required</span> — {f.note}</> : f.note}
          </span>
          {'\n'}
        </span>
      ))}
      {'  }\n]'}
    </div>
  );
}

function CsvTemplate({ fields }: { fields: FieldDef[] }) {
  return (
    <div class={styles.code}>
      <span class={styles.comment}>{'// Header row'}{'\n'}</span>
      {fields.map((f, i) => (
        <span key={f.name}>
          <span class={styles.key}>{f.name}</span>
          {f.required && <span class={styles.required}> *</span>}
          {i < fields.length - 1 ? ',' : ''}
        </span>
      ))}
      {'\n'}
      <span class={styles.comment}>{'// Example row'}{'\n'}</span>
      <span class={styles.str}>{fields.map((f) => f.example).join(',')}</span>
      {'\n\n'}
      {fields.map((f) => (
        <span key={f.name}>
          <span class={styles.comment}>
            {f.required ? <span class={styles.required}>*</span> : ' '}{' '}
            <span class={styles.key}>{f.name}</span>: {f.note}
          </span>
          {'\n'}
        </span>
      ))}
    </div>
  );
}

export function FormatTemplate({ format, mode, scope }: FormatTemplateProps) {
  const fields = getFields(scope, mode);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const text = buildTemplateText(format, fields);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access may be denied in insecure contexts
    }
  };

  return (
    <div class={styles.card}>
      <div class={styles.header}>
        <span class={styles.headerTitle}>Input Template</span>
        <div class={styles.headerActions}>
          {mode === 'reissue' && (
            <span class={styles.reissueBadge}>
              existing tokens will be revoked
            </span>
          )}
          <button
            class={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
            onClick={handleCopy}
            title="Copy template"
          >
            {copied ? <><IconCheck size={12} /> Copied</> : <><IconCopy size={12} /> Copy</>}
          </button>
        </div>
      </div>
      <div class={styles.body}>
        <div key={`${format}-${mode}-${scope}`} class={styles.bodyContent}>
          {format === 'json' ? (
            <JsonTemplate fields={fields} />
          ) : (
            <CsvTemplate fields={fields} />
          )}
        </div>
      </div>
    </div>
  );
}
