import { useState } from 'preact/hooks';
import { getSettings, setSettings, applySettings } from '@/lib/settings';
import type { Settings } from '@/lib/settings';
import styles from './settings.module.css';

export function SettingsPage() {
  const [current, setCurrent] = useState<Settings>(getSettings);

  const update = (partial: Partial<Settings>) => {
    const updated = { ...current, ...partial };
    setCurrent(updated);
    setSettings(partial);
    applySettings(updated);
  };

  return (
    <div class={styles.page}>
      <h2 class={styles.title}>Settings</h2>

      <div class={styles.sections}>
        <section class={styles.section}>
          <h3 class={styles.sectionTitle}>Appearance</h3>

          <div class={styles.field}>
            <label class={styles.label}>Theme</label>
            <div class={styles.options}>
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  class={`${styles.optionBtn} ${current.theme === t ? styles.optionBtnActive : ''}`}
                  onClick={() => update({ theme: t })}
                >
                  {t === 'light' ? '☀ Light' : t === 'dark' ? '🌙 Dark' : '💻 System'}
                </button>
              ))}
            </div>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Font Size</label>
            <div class={styles.options}>
              {([['small', '13px'], ['medium', '14px'], ['large', '16px']] as const).map(([size, px]) => (
                <button
                  key={size}
                  class={`${styles.optionBtn} ${current.fontSize === size ? styles.optionBtnActive : ''}`}
                  onClick={() => update({ fontSize: size })}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)} ({px})
                </button>
              ))}
            </div>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Table Density</label>
            <div class={styles.options}>
              {(['compact', 'default', 'comfortable'] as const).map((d) => (
                <button
                  key={d}
                  class={`${styles.optionBtn} ${current.tableDensity === d ? styles.optionBtnActive : ''}`}
                  onClick={() => update({ tableDensity: d })}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
