interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  contentType?: string;
  params?: Record<string, string | number | undefined>;
}

export interface ApiError {
  status: number;
  message: string;
}

function getStore(): Storage {
  return localStorage.getItem('am_remember') ? localStorage : sessionStorage;
}

export function getCredentials() {
  const store = getStore();
  const securityKey = store.getItem('am_security_key');
  const operatorKey = store.getItem('am_operator_key');
  if (!securityKey || !operatorKey) return null;
  return { securityKey, operatorKey };
}

export function saveCredentials(securityKey: string, operatorKey: string, remember: boolean): void {
  // Clear both storages first to avoid stale keys
  for (const s of [localStorage, sessionStorage]) {
    s.removeItem('am_security_key');
    s.removeItem('am_operator_key');
  }
  if (remember) {
    localStorage.setItem('am_remember', '1');
  } else {
    localStorage.removeItem('am_remember');
  }
  const store = remember ? localStorage : sessionStorage;
  store.setItem('am_security_key', securityKey);
  store.setItem('am_operator_key', operatorKey);
}

export function clearCredentials(): void {
  localStorage.removeItem('am_remember');
  for (const s of [localStorage, sessionStorage]) {
    s.removeItem('am_security_key');
    s.removeItem('am_operator_key');
  }
}

let onAuthError: (() => void) | null = null;

export function setAuthErrorHandler(handler: (() => void) | null): void {
  onAuthError = handler;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const creds = getCredentials();
  if (!creds) throw { status: 401, message: 'Not authenticated' } as ApiError;

  const { method = 'GET', body, contentType, params } = options;

  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    'X-Security': creds.securityKey,
    'X-App-Name': import.meta.env.VITE_ADMIN_APP_NAME || 'am-panel',
    'X-Operator-Key': creds.operatorKey,
  };

  if (body !== undefined) {
    headers['Content-Type'] = contentType || 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined
        ? (contentType === 'text/csv' ? body as string : JSON.stringify(body))
        : undefined,
    });
  } catch {
    throw { status: 0, message: 'Network error — check your connection' } as ApiError;
  }

  if (response.status === 401 || response.status === 403) {
    onAuthError?.();
    throw { status: response.status, message: 'Session expired' } as ApiError;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { status: response.status, message: data.message || 'Request failed' } as ApiError;
  }

  return response.json();
}
