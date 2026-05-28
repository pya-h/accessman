import { request } from './client';

export type LetterCase = 'upper' | 'lower' | 'both';

export interface ServerSettings {
  codeLength: number;
  prefixAppName: boolean;
  includeNumbers: boolean;
  letterCase: LetterCase;
  includeSpecial: boolean;
}

export function getServerSettings(): Promise<ServerSettings> {
  return request('/api/settings');
}

export function updateServerSettings(
  partial: Partial<ServerSettings>,
): Promise<ServerSettings> {
  return request('/api/settings', { method: 'PATCH', body: partial });
}
