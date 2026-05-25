import { useState, useEffect } from 'preact/hooks';
import { IconCheck, IconX, IconAlert } from '@/components/icons';
import styles from './toast.module.css';

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  removing?: boolean;
}

let nextId = 0;
let listeners: Array<() => void> = [];
let toasts: Toast[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function showToast(type: ToastType, message: string, duration = 5000) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  notify();

  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
}

export function dismissToast(id: number) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, removing: true } : t));
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 200);
}

export function ToastContainer() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div class={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          class={`${styles.toast} ${styles[toast.type]} ${toast.removing ? styles.removing : ''}`}
          onClick={() => dismissToast(toast.id)}
        >
          <span class={styles.icon}>
            {toast.type === 'success' ? <IconCheck size={14} /> : toast.type === 'error' ? <IconX size={14} /> : <IconAlert size={14} />}
          </span>
          <span class={styles.message}>{toast.message}</span>
          <button
            class={styles.closeBtn}
            onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
            aria-label="Dismiss"
          >
            <IconX size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
