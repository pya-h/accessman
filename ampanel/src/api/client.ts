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

export function getCredentials() {
  const baseUrl = sessionStorage.getItem('am_base_url');
  const securityKey = sessionStorage.getItem('am_security_key');
  const operatorKey = sessionStorage.getItem('am_operator_key');
  if (!baseUrl || !securityKey || !operatorKey) return null;
  return { baseUrl, securityKey, operatorKey };
}

export function clearCredentials(): void {
  sessionStorage.removeItem('am_base_url');
  sessionStorage.removeItem('am_security_key');
  sessionStorage.removeItem('am_operator_key');
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const creds = getCredentials();
  if (!creds) throw { status: 401, message: 'Not authenticated' } as ApiError;

  const { method = 'GET', body, contentType, params } = options;

  let url = `${creds.baseUrl}${path}`;
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
    'X-App-Name': 'am-panel',
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
    throw { status: 0, message: 'Network error — check your connection and backend URL' } as ApiError;
  }

  if (response.status === 401 || response.status === 403) {
    clearCredentials();
    throw { status: response.status, message: 'Session expired' } as ApiError;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw { status: response.status, message: data.message || 'Request failed' } as ApiError;
  }

  return response.json();
}
