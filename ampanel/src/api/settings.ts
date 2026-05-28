import { request } from './client';

export interface ServerSettings {
  codeLength: number;
  prefixAppName: boolean;
}

export function getServerSettings(): Promise<ServerSettings> {
  return request('/api/settings');
}

export function updateServerSettings(
  partial: Partial<ServerSettings>,
): Promise<ServerSettings> {
  return request('/api/settings', { method: 'PATCH', body: partial });
}
