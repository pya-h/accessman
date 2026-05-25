import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { IconChevronDown } from './icons';
import styles from './custom-select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  fullWidth?: boolean;
  triggerClass?: string;
}

export function CustomSelect({ value, options, onChange, fullWidth, triggerClass }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, close]);

  return (
    <div
      ref={wrapperRef}
      class={`${styles.wrapper} ${fullWidth ? styles.wrapperFull : ''}`}
    >
      <button
        class={`${styles.trigger} ${open ? styles.triggerOpen : ''} ${triggerClass || ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span>{selected?.label || 'Select...'}</span>
        <IconChevronDown
          size={14}
          class={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {open && (
        <div class={styles.dropdown}>
          {options.map((o) => (
            <button
              key={o.value}
              class={`${styles.option} ${o.value === value ? styles.optionActive : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              type="button"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
