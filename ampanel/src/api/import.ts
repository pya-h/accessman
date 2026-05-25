import { request } from './client';

export interface ImportResponse {
  imported: { userId: string; appName: string; token: string; expiresAt: string }[];
  errors: { userId: string; appName: string; reason: string }[];
}

export type ImportMode = 'import' | 'reissue';
export type ImportFormat = 'json' | 'csv';

export function importTokens(
  data: string | unknown[],
  format: ImportFormat,
  mode: ImportMode,
  appName?: string,
): Promise<ImportResponse> {
  const contentType = format === 'csv' ? 'text/csv' : 'application/json';

  if (mode === 'reissue') {
    return request('/api/import/reissue', { method: 'POST', body: data, contentType });
  }
  if (appName) {
    return request(`/api/import/${appName}`, { method: 'POST', body: data, contentType });
  }
  return request('/api/import', { method: 'POST', body: data, contentType });
}
