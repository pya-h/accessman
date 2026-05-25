import type { ImportFormat, ImportMode } from '@/api/import';
import styles from './format-template.module.css';

interface FormatTemplateProps {
  format: ImportFormat;
  mode: ImportMode;
  scope: 'all' | 'single';
}

interface FieldDef {
  name: string;
  required: boolean;
  example: string;
  note: string;
}

function getFields(scope: 'all' | 'single', mode: ImportMode): FieldDef[] {
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
      example: scope === 'all' ? 'myapp_CustomSecretToken01' : '{appName}_CustomSecretToken01',
      note: 'auto-generated if omitted. Format: {appName}_{CODE}, CODE is 8–64 chars',
    },
  );
  return fields;
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
