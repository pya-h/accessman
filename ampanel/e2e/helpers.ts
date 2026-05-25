export const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
export const SECURITY_KEY = 'pw-test-security-key-12345';
export const OPERATOR_KEY = 'pw-test-operator-key-12345';
export const ADMIN_APP_NAME = 'am-panel';
export const PID_FILE = '/tmp/pw-accessman-server.pid';

export const TEST_DB_URL =
  process.env.DATABASE_TEST_URL ||
  'postgresql://johndoe:whathefuck3ver@localhost:5432/accessman_test';

export function operatorHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Security': SECURITY_KEY,
    'X-App-Name': ADMIN_APP_NAME,
    'X-Operator-Key': OPERATOR_KEY,
  };
}

export async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...operatorHeaders(), ...(options.headers as Record<string, string>) },
  });
  return res.json();
}
