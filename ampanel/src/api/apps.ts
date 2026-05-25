import { request } from './client';

export interface AppRecord {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export function listApps(): Promise<AppRecord[]> {
  return request('/api/apps');
}

export function createApp(name: string): Promise<AppRecord> {
  return request('/api/apps', { method: 'POST', body: { name } });
}
