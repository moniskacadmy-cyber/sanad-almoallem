interface Env {
  APP_CRON_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runReminderCron(env));
  },

  async fetch(_request: Request, env: Env): Promise<Response> {
    if (!env.APP_CRON_URL || !env.CRON_SECRET) {
      return new Response("Reminder worker is not configured.", { status: 503 });
    }
    return new Response("Sanad Al-Moallem reminder worker is running.", { status: 200 });
  },
};

async function runReminderCron(env: Env): Promise<void> {
  if (!env.APP_CRON_URL || !env.CRON_SECRET) {
    console.error("Missing APP_CRON_URL or CRON_SECRET");
    return;
  }
  try {
    const response = await fetch(env.APP_CRON_URL, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + env.CRON_SECRET,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Reminder cron failed", response.status, body.slice(0, 500));
      return;
    }
    console.log("Reminder cron completed", response.status);
  } catch (error) {
    console.error("Reminder cron request failed", error);
  }
}
