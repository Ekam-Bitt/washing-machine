import webpush, { type PushSubscription } from "web-push";
import { store } from "./store";
import type { Notice } from "./types";

const subKey = (deviceId: string) => `wm:push:${deviceId}`;

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export async function saveSubscription(deviceId: string, sub: PushSubscription) {
  await store().set(subKey(deviceId), sub, { ex: 60 * 60 * 24 * 180 });
}

export async function deleteSubscription(deviceId: string) {
  await store().del(subKey(deviceId));
}

export async function sendNotices(notices: Notice[]) {
  if (!notices.length || !configure()) return;
  await Promise.all(
    notices.map(async (n) => {
      const sub = await store().get<PushSubscription>(subKey(n.deviceId));
      if (!sub) return;
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({ title: n.title, body: n.body, tag: n.tag, url: "/" }),
          { TTL: 60 * 60, urgency: "high" },
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await deleteSubscription(n.deviceId);
        else console.error("push failed", code, err);
      }
    }),
  );
}
