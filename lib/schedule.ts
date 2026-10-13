import { Client } from "@upstash/qstash";

function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : null;
}

/**
 * Asks QStash to call /api/jobs/cycle-end when a cycle finishes, so the
 * "wash complete" and "you're up" pushes go out even if nobody has the page
 * open. Without QStash (local dev) the next page poll does the same work.
 */
export async function scheduleCycleEnd(endsAt: number) {
  const token = process.env.QSTASH_TOKEN;
  const url = baseUrl();
  if (!token || !url) return;
  try {
    const client = new Client({ token, baseUrl: process.env.QSTASH_URL });
    await client.publishJSON({
      url: `${url}/api/jobs/cycle-end`,
      body: { endsAt },
      notBefore: Math.ceil(endsAt / 1000),
      retries: 3,
    });
  } catch (err) {
    console.error("QStash schedule failed", err);
  }
}
