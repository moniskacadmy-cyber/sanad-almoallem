import { getAuthenticatedHeaders } from './authHelper';
import { buildIcs, type FeedSlot } from '../utils/icsBuilder';

export interface CalendarFeedLinks {
  url: string | null;
  https?: string;
  webcal?: string;
}

async function call(method: 'GET' | 'POST' | 'DELETE'): Promise<any> {
  const headers = await getAuthenticatedHeaders();
  const res = await fetch('/api/calendar/feed', { method, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'تعذر الاتصال بالسيرفر.');
  return data;
}

export async function getCalendarFeed(): Promise<CalendarFeedLinks> {
  const d = await call('GET');
  return d.https ? { url: d.https, https: d.https, webcal: d.webcal } : { url: null };
}

/** Creates a link, or replaces the old one (the old link stops working). */
export async function createCalendarFeed(): Promise<CalendarFeedLinks> {
  const d = await call('POST');
  return { url: d.https, https: d.https, webcal: d.webcal };
}

export async function revokeCalendarFeed(): Promise<void> {
  await call('DELETE');
}

/** Google Calendar "add by URL" page (opens with the feed URL pre-filled; the user just confirms). */
export const googleAddByUrl = (webcal: string) => `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcal)}`;

/** One-off .ics download of a single class (works offline-of-server, no account, no warnings). */
export function downloadSlotIcs(slot: FeedSlot, timeZone = 'Africa/Cairo', alarmMinutes = [15]) {
  const ics = buildIcs({ calendarName: slot.title, timeZone, slots: [slot], alarmMinutes });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'class.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
