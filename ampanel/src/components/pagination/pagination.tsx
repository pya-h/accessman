import styles from './pagination.module.css';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div class={styles.pagination}>
      <span class={styles.info}>
        {total > 0 ? `${start}–${end} of ${total}` : 'No results'}
      </span>
      <div class={styles.buttons}>
        <button
          class={styles.btn}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          class={styles.btn}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
