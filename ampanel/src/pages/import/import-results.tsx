import { useState, useMemo } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ImportResponse } from '@/api/import';
import { getLastImportResult } from './import';
import { DataTable } from '@/components/table/data-table';
import type { Column } from '@/components/table/data-table';
import { downloadCsv } from '@/lib/csv-export';
import { showToast } from '@/components/toast';
import styles from './import-results.module.css';

type ImportedToken = ImportResponse['imported'][number];
type ImportError = ImportResponse['errors'][number];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => showToast('success', 'Copied to clipboard'),
    () => showToast('error', 'Failed to copy'),
  );
}

export function ImportResultsPage() {
  const { route } = useLocation();
  const [result] = useState<ImportResponse | null>(() => getLastImportResult());

  const [tokensExpanded, setTokensExpanded] = useState(true);
  const [errorsExpanded, setErrorsExpanded] = useState(true);

  if (!result) {
    route('/import', true);
    return null;
  }

  const { imported, errors } = result;

  const handleCopyAll = () => {
    const text = imported.map((t) => `${t.userId}: ${t.token}`).join('\n');
    copyToClipboard(text);
  };

  const handleDownloadCsv = () => {
    downloadCsv(
      ['userId', 'appName', 'token', 'expiresAt'],
      imported.map((t) => [t.userId, t.appName, t.token, t.expiresAt]),
      'imported-tokens.csv',
    );
  };

  const tokenColumns: Column<ImportedToken>[] = useMemo(() => [
    { key: 'userId', header: 'User ID', render: (t) => t.userId },
    { key: 'appName', header: 'App', render: (t) => t.appName },
    {
      key: 'token',
      header: 'Token',
      mono: true,
      render: (t) => (
        <span class={styles.tokenCell}>
          <span class={styles.tokenText}>{t.token}</span>
          <button class={styles.copyBtn} onClick={() => copyToClipboard(t.token)} title="Copy">
            copy
          </button>
        </span>
      ),
    },
    { key: 'expiresAt', header: 'Expires At', render: (t) => t.expiresAt },
  ], []);

  const errorColumns: Column<ImportError>[] = useMemo(() => [
    { key: 'userId', header: 'User ID', render: (e) => e.userId },
    { key: 'appName', header: 'App', render: (e) => e.appName },
    { key: 'reason', header: 'Reason', render: (e) => <span class={styles.errorReason}>{e.reason}</span> },
  ], []);

  return (
    <div class={styles.page}>
      <h2 class={styles.title}>Import Results</h2>

      <div class={styles.warning}>
        These tokens are shown only once and cannot be retrieved again.
      </div>

      {/* Imported tokens */}
      {imported.length > 0 && (
        <section class={styles.section}>
          <button class={styles.sectionHeader} onClick={() => setTokensExpanded(!tokensExpanded)}>
            <span class={styles.sectionTitle}>
              Imported Tokens ({imported.length})
            </span>
            <span class={styles.chevron}>{tokensExpanded ? '−' : '+'}</span>
          </button>

          {tokensExpanded && (
            <>
              <div class={styles.sectionActions}>
                <button class={styles.actionBtn} onClick={handleCopyAll}>
                  Copy All Tokens
                </button>
                <button class={styles.actionBtn} onClick={handleDownloadCsv}>
                  Download CSV
                </button>
              </div>
              <DataTable columns={tokenColumns} data={imported} emptyMessage="No tokens imported" />
            </>
          )}
        </section>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <section class={`${styles.section} ${styles.errorSection}`}>
          <button class={styles.sectionHeader} onClick={() => setErrorsExpanded(!errorsExpanded)}>
            <span class={styles.sectionTitle}>
              Errors ({errors.length})
            </span>
            <span class={styles.chevron}>{errorsExpanded ? '−' : '+'}</span>
          </button>

          {errorsExpanded && (
            <DataTable columns={errorColumns} data={errors} emptyMessage="No errors" />
          )}
        </section>
      )}

      {imported.length === 0 && errors.length === 0 && (
        <p class={styles.empty}>No results returned.</p>
      )}

      <div class={styles.actions}>
        <button class={styles.navBtn} onClick={() => route('/import')}>
          New Import
        </button>
        <button class={styles.navBtn} onClick={() => route('/tokens')}>
          Go to Tokens
        </button>
      </div>
    </div>
  );
}
