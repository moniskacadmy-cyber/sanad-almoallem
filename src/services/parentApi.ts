import { getAuthenticatedHeaders } from './authHelper';

export interface ParentLinkInfo {
  code: string;
  url: string;
  expiresAtMs: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthenticatedHeaders();
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || 'تعذر الاتصال بالسيرفر.');
  return data as T;
}

export async function getParentLink(studentId: string): Promise<ParentLinkInfo | null> {
  const r = await call<{ link: ParentLinkInfo | null }>(`/api/parent/links?studentId=${encodeURIComponent(studentId)}`);
  return r.link || null;
}

/** Creates a NEW code (the previous one of this student stops working immediately). */
export async function createParentLink(studentId: string, expiresInDays: number): Promise<ParentLinkInfo> {
  return call<ParentLinkInfo>('/api/parent/links', {
    method: 'POST',
    body: JSON.stringify({ studentId, expiresInDays }),
  });
}

export async function revokeParentLink(studentId: string): Promise<void> {
  await call('/api/parent/links/revoke', { method: 'POST', body: JSON.stringify({ studentId }) });
}

export async function getParentSettings(): Promise<{ showFinance: boolean }> {
  return call<{ showFinance: boolean }>('/api/parent/settings');
}

export async function setParentShowFinance(showFinance: boolean): Promise<void> {
  await call('/api/parent/settings', { method: 'POST', body: JSON.stringify({ showFinance }) });
}
