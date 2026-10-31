import { getAuthenticatedHeaders } from './authHelper';

export interface PublicSlot { day: number; from: string; to: string }
export interface PublicTeacher {
  slug: string;
  name: string;
  subject: string;
  stages: string[];
  experienceYears: number;
  bio: string;
  city: string;
  slots: PublicSlot[];
}
export interface PublicProfileForm extends PublicTeacher { enabled: boolean; directoryListed: boolean }
export interface BookingRow {
  id: string;
  studentName: string;
  parentName?: string;
  phone: string;
  stage?: string;
  note?: string;
  slot?: PublicSlot | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAtMs: number;
}

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthenticatedHeaders();
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || 'تعذر الاتصال بالسيرفر.');
  return data as T;
}

async function open<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || 'تعذر الاتصال بالسيرفر.');
  return data as T;
}

export const getMyPublicProfile = () => authed<{ profile: PublicProfileForm | null }>('/api/public/profile').then((r) => r.profile);
export const saveMyPublicProfile = (form: PublicProfileForm) =>
  authed<{ slug: string }>('/api/public/profile', { method: 'POST', body: JSON.stringify(form) });
export const getMyBookings = () => authed<{ bookings: BookingRow[] }>('/api/public/bookings').then((r) => r.bookings);
export const decideBooking = (id: string, status: 'approved' | 'rejected') =>
  authed('/api/public/bookings/decide', { method: 'POST', body: JSON.stringify({ id, status }) });

export const getPublicTeacher = (slug: string) =>
  open<{ teacher: PublicTeacher }>(`/api/public/teacher?slug=${encodeURIComponent(slug)}`).then((r) => r.teacher);
export const getDirectory = (q: string) =>
  open<{ teachers: PublicTeacher[] }>(`/api/public/directory?q=${encodeURIComponent(q)}`).then((r) => r.teachers);
export const sendBooking = (payload: Record<string, unknown>) =>
  open('/api/public/book', { method: 'POST', body: JSON.stringify(payload) });

export const publicPageUrl = (slug: string) => `${window.location.origin}/t/${encodeURIComponent(slug)}`;
