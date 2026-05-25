import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import styles from './modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
  actions?: ComponentChildren;
}

export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button, [href], input')?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div class={styles.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        class={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div class={styles.header}>
          <h2 class={styles.title}>{title}</h2>
          <button class={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div class={styles.body}>{children}</div>
        {actions && <div class={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
