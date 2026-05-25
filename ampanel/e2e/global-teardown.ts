import { readFileSync, unlinkSync, existsSync } from 'fs';
import { PID_FILE } from './helpers';

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(PID_FILE)) return;

  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8'), 10);
    // Kill the process group (negative PID kills the group)
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Process may have already exited
  }

  try {
    unlinkSync(PID_FILE);
  } catch {
    // ignore
  }

  console.log('[teardown] Server stopped');
}
