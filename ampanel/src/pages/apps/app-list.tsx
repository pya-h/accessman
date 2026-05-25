import { useState, useMemo } from 'preact/hooks';
import { listApps, createApp } from '@/api/apps';
import type { AppRecord } from '@/api/apps';
import { useQuery } from '@/lib/use-query';
import { relativeTime } from '@/lib/relative-time';
import { DataTable } from '@/components/table/data-table';
import type { Column } from '@/components/table/data-table';
import { StatusBadge } from '@/components/status-badge';
import { showToast } from '@/components/toast';
import styles from './app-list.module.css';

export function AppListPage() {
  const { data: apps, loading, refetch } = useQuery(() => listApps(), []);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await createApp(trimmed);
      showToast('success', `App "${trimmed}" registered`);
      setName('');
      setShowForm(false);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to register app';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<AppRecord>[] = useMemo(() => [
    { key: 'id', header: 'ID', width: '60px', render: (a) => a.id },
    { key: 'name', header: 'Name', render: (a) => a.name },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (a) => <StatusBadge status={a.isActive ? 'active' : 'revoked'} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (a) => relativeTime(a.createdAt),
    },
  ], []);

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <h2 class={styles.title}>Apps</h2>
        <button class={styles.registerBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Register App'}
        </button>
      </div>

      {showForm && (
        <form class={styles.form} onSubmit={handleSubmit}>
          <input
            class={styles.input}
            type="text"
            placeholder="App name"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            autoFocus
          />
          <button class={styles.submitBtn} type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Registering...' : 'Register'}
          </button>
        </form>
      )}

      <DataTable
        columns={columns}
        data={apps || []}
        loading={loading}
        emptyMessage="No apps registered"
      />
    </div>
  );
}
