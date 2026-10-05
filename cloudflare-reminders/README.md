# Sanad Al-Moallem — Free Reminder Scheduler

This Cloudflare Worker calls the protected Vercel reminder endpoint every 5 minutes.

## Cloudflare setup

1. Connect this repository in Cloudflare Workers & Pages.
2. Set the Worker root directory to `cloudflare-reminders` if Cloudflare asks for one.
3. Set these Worker variables/secrets:
   - `APP_CRON_URL` = `https://sanad-almoallem-three.vercel.app/api/reminders/cron`
   - `CRON_SECRET` = the exact same secret configured in Vercel.
4. Deploy the Worker.

The schedule is `*/5 * * * *` (every minute, UTC). The Vercel endpoint converts the current time into each teacher's saved timezone and reminder lead time, then sends Firebase Cloud Messaging notifications.

Do not put `CRON_SECRET` in GitHub or in this file.
