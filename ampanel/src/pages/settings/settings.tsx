import { useState, useEffect } from 'preact/hooks';
import { getSettings, setSettings, applySettings, ACCENT_PRESETS } from '@/lib/settings';
import type { Settings } from '@/lib/settings';
import { getServerSettings, updateServerSettings } from '@/api/settings';
import { useQuery } from '@/lib/use-query';
import { showToast } from '@/components/toast';
import { IconSun, IconMoon, IconMonitor, IconPalette } from '@/components/icons';
import styles from './settings.module.css';

export function SettingsPage() {
  const [current, setCurrent] = useState<Settings>(getSettings);

  const update = (partial: Partial<Settings>) => {
    const updated = { ...current, ...partial };
    setCurrent(updated);
    setSettings(partial);
    applySettings(updated);
  };

  // Server-side token-generation settings (global, shared by all imports)
  const { data: serverSettings } = useQuery(() => getServerSettings(), []);
  const [codeLength, setCodeLength] = useState(4);
  const [prefixAppName, setPrefixAppName] = useState(false);

  useEffect(() => {
    if (serverSettings) {
      setCodeLength(serverSettings.codeLength);
      setPrefixAppName(serverSettings.prefixAppName);
    }
  }, [serverSettings]);

  const persistCodeLength = async (value: number) => {
    const clamped = Math.max(4, Math.min(64, Math.round(value) || 4));
    setCodeLength(clamped);
    try {
      const saved = await updateServerSettings({ codeLength: clamped });
      setCodeLength(saved.codeLength);
      showToast('success', `Access code length set to ${saved.codeLength}`);
    } catch (err) {
      showToast('error', (err as { message?: string })?.message || 'Failed to update setting');
    }
  };

  const persistPrefix = async (value: boolean) => {
    if (value === prefixAppName) return;
    const previous = prefixAppName;
    setPrefixAppName(value);
    try {
      const saved = await updateServerSettings({ prefixAppName: value });
      setPrefixAppName(saved.prefixAppName);
      showToast('success', 'Token generation setting updated');
    } catch (err) {
      setPrefixAppName(previous);
      showToast('error', (err as { message?: string })?.message || 'Failed to update setting');
    }
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
              {([['light', 'Light', IconSun], ['dark', 'Dark', IconMoon], ['system', 'System', IconMonitor]] as const).map(([t, label, Icon]) => (
                <button
                  key={t}
                  class={`${styles.optionBtn} ${current.theme === t ? styles.optionBtnActive : ''}`}
                  onClick={() => update({ theme: t })}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>
              <IconPalette size={14} /> Accent Color
            </label>
            <div class={styles.colorOptions}>
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  class={`${styles.colorSwatch} ${current.accentColor === preset.value ? styles.colorSwatchActive : ''}`}
                  style={{ '--swatch-color': preset.value } as Record<string, string>}
                  onClick={() => update({ accentColor: preset.value })}
                  title={preset.name}
                  aria-label={`${preset.name} accent color`}
                />
              ))}
            </div>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Font Size</label>
            <div class={styles.options}>
              {([['small', '13px'], ['medium', '14px'], ['large', '16px'], ['xlarge', '18px']] as const).map(([size, px]) => (
                <button
                  key={size}
                  class={`${styles.optionBtn} ${current.fontSize === size ? styles.optionBtnActive : ''}`}
                  onClick={() => update({ fontSize: size })}
                >
                  {size === 'xlarge' ? 'X-Large' : size.charAt(0).toUpperCase() + size.slice(1)} ({px})
                </button>
              ))}
            </div>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Border Radius</label>
            <div class={styles.options}>
              {(['sharp', 'default', 'round'] as const).map((r) => (
                <button
                  key={r}
                  class={`${styles.optionBtn} ${current.borderRadius === r ? styles.optionBtnActive : ''}`}
                  onClick={() => update({ borderRadius: r })}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
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

        {/* Token generation (server-side, global) */}
        <section class={styles.section}>
          <h3 class={styles.sectionTitle}>Token Generation</h3>

          <div class={styles.field}>
            <label class={styles.label}>Access Code Length</label>
            <input
              type="number"
              min={4}
              max={64}
              class={styles.numberInput}
              value={codeLength}
              onInput={(e) =>
                setCodeLength(Number((e.target as HTMLInputElement).value))
              }
              onChange={(e) =>
                persistCodeLength(Number((e.target as HTMLInputElement).value))
              }
            />
            <span class={styles.hint}>
              Length of auto-generated access codes (4–64). Custom tokens provided on import bypass this.
            </span>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Prefix App Name</label>
            <div class={styles.options}>
              {([[false, 'Off'], [true, 'On']] as const).map(([val, label]) => (
                <button
                  key={label}
                  class={`${styles.optionBtn} ${prefixAppName === val ? styles.optionBtnActive : ''}`}
                  onClick={() => persistPrefix(val)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span class={styles.hint}>
              Prepend the app name to generated codes (e.g. <code class="mono">myapp_a1b2</code>). For display only — the app is verified via the request header, not the prefix.
            </span>
          </div>
        </section>

        {/* Live preview */}
        <section class={styles.section}>
          <h3 class={styles.sectionTitle}>Preview</h3>
          <div class={styles.previewRow}>
            <div class={styles.previewBadge} style={{ background: 'color-mix(in srgb, var(--color-status-active) 12%, transparent)', color: 'var(--color-status-active)' }}>
              <span class={styles.previewDot} style={{ background: 'var(--color-status-active)' }} />
              active
            </div>
            <div class={styles.previewBadge} style={{ background: 'color-mix(in srgb, var(--color-status-expired) 12%, transparent)', color: 'var(--color-status-expired)' }}>
              <span class={styles.previewDot} style={{ background: 'var(--color-status-expired)' }} />
              expired
            </div>
            <div class={styles.previewBadge} style={{ background: 'color-mix(in srgb, var(--color-status-revoked) 12%, transparent)', color: 'var(--color-status-revoked)' }}>
              <span class={styles.previewDot} style={{ background: 'var(--color-status-revoked)' }} />
              revoked
            </div>
          </div>
          <div class={styles.previewRow}>
            <button class={styles.previewPrimary}>Primary Button</button>
            <button class={styles.previewOutline}>Outline Button</button>
          </div>
          <div class={styles.previewCard}>
            <div class={styles.previewCardHeader}>Sample Card</div>
            <div class={styles.previewCardBody}>
              This is how cards and text will look with your current settings.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
