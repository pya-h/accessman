import type { ImportFormat, ImportMode } from '@/api/import';
import styles from './format-template.module.css';

interface FormatTemplateProps {
  format: ImportFormat;
  mode: ImportMode;
  scope: 'all' | 'single';
}

interface FieldDef {
  name: string;
  type: string;
  required: boolean;
}

function getFields(scope: 'all' | 'single'): FieldDef[] {
  const fields: FieldDef[] = [
    { name: 'userId', type: 'string', required: true },
  ];
  if (scope === 'all') {
    fields.push({ name: 'appName', type: 'string', required: true });
  }
  fields.push(
    { name: 'expiresAt', type: 'ISO date', required: false },
    { name: 'token', type: 'string 8-64 chars', required: false },
  );
  return fields;
}

function JsonTemplate({ fields }: { fields: FieldDef[] }) {
  return (
    <div class={styles.code}>
      {'[\n  {\n'}
      {fields.map((f, i) => (
        <span key={f.name}>
          {'    '}<span class={styles.key}>"{f.name}"</span>: <span class={styles.str}>"{f.type}"</span>
          {i < fields.length - 1 ? ',' : ''}
          {' '}
          <span class={f.required ? styles.comment : `${styles.comment} ${styles.optional}`}>
            {'// '}{f.required ? <span class={styles.required}>*required</span> : 'optional'}
          </span>
          {'\n'}
        </span>
      ))}
      {'  }\n]'}
    </div>
  );
}

function CsvTemplate({ fields }: { fields: FieldDef[] }) {
  const headerAnnotations = fields.map(
    (f) => `${f.name}${f.required ? ' *' : ''}`,
  );
  const exampleValues = fields.map((f) => {
    switch (f.name) {
      case 'userId': return 'user123';
      case 'appName': return 'myapp';
      case 'expiresAt': return '2025-12-31T00:00:00Z';
      case 'token': return 'custom_tok';
      default: return '...';
    }
  });

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
      <span class={styles.str}>{exampleValues.join(',')}</span>
      {'\n\n'}
      <span class={styles.comment}>
        <span class={styles.required}>*</span> required
        {'  '}
        <span class={styles.optional}>unmarked = optional</span>
      </span>
    </div>
  );
}

export function FormatTemplate({ format, mode, scope }: FormatTemplateProps) {
  const fields = getFields(scope);

  return (
    <div class={styles.card}>
      <div class={styles.header}>
        <span class={styles.headerTitle}>Input Template</span>
        {mode === 'reissue' && (
          <span class={styles.reissueBadge}>
            existing tokens for these users will be revoked
          </span>
        )}
      </div>
      <div class={styles.body}>
        {format === 'json' ? (
          <JsonTemplate fields={fields} />
        ) : (
          <CsvTemplate fields={fields} />
        )}
      </div>
    </div>
  );
}
