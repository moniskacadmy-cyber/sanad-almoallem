export interface Env { REMINDERS_URL: string; CRON_SECRET: string; }

async function runReminderCron(env: Env): Promise<Response> {
  const response = await fetch(env.REMINDERS_URL.replace(/\/$/, ''), {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}`, 'User-Agent': 'sanad-almoallem-free-reminder-cron/1.0' },
  });
  const body = await response.text();
  if (!response.ok) { console.error('Reminder cron failed:', response.status, body.slice(0, 500)); return new Response('Reminder cron failed', { status: 502 }); }
  return new Response('Reminder cron completed', { status: 200 });
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(runReminderCron(env)); },
  async fetch() { return new Response('Sanad Almoallem reminder scheduler is running.'); },
};
