import { useState } from 'preact/hooks';
import { JsonViewer } from './json-viewer';
import { Modal } from './modal';
import { showToast } from './toast';
import styles from './metadata-viewer.module.css';

interface MetadataViewerProps {
  data: Record<string, unknown>;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => showToast('success', 'Copied to clipboard'),
    () => showToast('error', 'Failed to copy'),
  );
}

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

function formatPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return String(value);
}

export function MetadataViewer({ data }: MetadataViewerProps) {
  const [tab, setTab] = useState<'raw' | 'table'>('table');
  const [compact, setCompact] = useState(false);
  const [nestedModal, setNestedModal] = useState<{ key: string; value: unknown } | null>(null);

  const entries = Object.entries(data);

  if (entries.length === 0) {
    return <div class={styles.empty}>No metadata</div>;
  }

  const rawJson = compact ? JSON.stringify(data) : JSON.stringify(data, null, 2);

  return (
    <>
      <div class={styles.container}>
        <div class={styles.tabs}>
          <button
            class={`${styles.tab} ${tab === 'table' ? styles.tabActive : ''}`}
            onClick={() => setTab('table')}
          >
            Table
          </button>
          <button
            class={`${styles.tab} ${tab === 'raw' ? styles.tabActive : ''}`}
            onClick={() => setTab('raw')}
          >
            Raw
          </button>
        </div>

        {tab === 'raw' && (
          <>
            <div class={styles.rawHeader}>
              <button class={styles.toggleCompact} onClick={() => setCompact(!compact)}>
                {compact ? 'Pretty' : 'Compact'}
              </button>
              <button class={styles.copyBtn} onClick={() => copyToClipboard(rawJson)}>
                Copy
              </button>
            </div>
            <div class={styles.rawContent}>{rawJson}</div>
          </>
        )}

        {tab === 'table' && (
          <table class={styles.kvTable}>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} class={styles.kvRow}>
                  <td class={styles.kvKey}>{key}</td>
                  <td class={styles.kvValue}>
                    {isPrimitive(value) ? (
                      <span class={typeof value === 'string' ? '' : styles.kvValueMono}>
                        {formatPrimitive(value)}
                      </span>
                    ) : (
                      <span class={styles.nestedPreview}>
                        <span class={styles.previewText}>
                          {JSON.stringify(value)}
                        </span>
                        <button
                          class={styles.viewBtn}
                          onClick={() => setNestedModal({ key, value })}
                        >
                          View
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={nestedModal !== null}
        onClose={() => setNestedModal(null)}
        title={nestedModal?.key ?? ''}
      >
        {nestedModal && <JsonViewer data={nestedModal.value} />}
      </Modal>
    </>
  );
}
