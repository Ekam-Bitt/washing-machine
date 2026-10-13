import { Client } from "@upstash/qstash";

function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : null;
}

/**
 * Asks QStash to call /api/jobs/cycle-end at each of `times` (unix seconds),
 * so timed pushes go out even if nobody has the page open. Without QStash
 * (local dev) the next page poll does the same work.
 */
export async function scheduleWakeups(times: number[]) {
  const token = process.env.QSTASH_TOKEN;
  const url = baseUrl();
  if (!times.length || !token || !url) return;
  const client = new Client({ token, baseUrl: process.env.QSTASH_URL });
  await Promise.all(
    times.map((notBefore) =>
      client
        .publishJSON({ url: `${url}/api/jobs/cycle-end`, body: { at: notBefore }, notBefore, retries: 3 })
        .catch((err) => console.error("QStash schedule failed", err)),
    ),
  );
}
