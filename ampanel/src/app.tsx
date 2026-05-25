import { applySettings, getSettings } from '@/lib/settings';

applySettings(getSettings());

export function App() {
  return (
    <div>
      <h1>AccessMan Panel</h1>
      <p>Panel is running.</p>
    </div>
  );
}
