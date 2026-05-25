import type { ComponentChildren } from 'preact';
import { EmptyState } from '@/components/empty-state';
import styles from './data-table.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ComponentChildren;
  align?: 'left' | 'right';
  sticky?: boolean;
  mono?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

const SKELETON_ROWS = 5;

export function DataTable<T>({ columns, data, onRowClick, loading, emptyMessage }: DataTableProps<T>) {
  if (!loading && data.length === 0) {
    return <EmptyState message={emptyMessage || 'No data found'} />;
  }

  return (
    <div class={styles.wrapper}>
      <table class={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                class={`${styles.th} ${col.align === 'right' ? styles.thRight : ''} ${col.sticky ? styles.stickyCol : ''}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} class={styles.row}>
                  {columns.map((col) => (
                    <td key={col.key} class={styles.td}>
                      <div class={styles.skeleton} style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            : data.map((row, i) => (
                <tr
                  key={i}
                  class={`${styles.row} ${onRowClick ? styles.rowClickable : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      class={`${styles.td} ${col.align === 'right' ? styles.tdRight : ''} ${col.mono ? styles.tdMono : ''} ${col.sticky ? styles.stickyCol : ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
}
