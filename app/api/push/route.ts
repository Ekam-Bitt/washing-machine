import type { PushSubscription } from "web-push";
import { authed, body, json } from "@/lib/http";
import { deleteSubscription, saveSubscription, sendNotices } from "@/lib/push";
import { BadInput } from "@/lib/validate";

/** Save this device's push subscription: { subscription, test? } */
export const POST = authed(async (req, device) => {
  const b = await body(req);
  const sub = b.subscription as PushSubscription | undefined;
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new BadInput("Invalid push subscription");
  }
  await saveSubscription(device, { endpoint: sub.endpoint, keys: sub.keys });
  if (b.test) {
    await sendNotices([
      { deviceId: device, tag: "test", title: "Alerts are on", body: "You'll get a ping here when it's your turn." },
    ]);
  }
  return json({ ok: true });
});

export const DELETE = authed(async (_req, device) => {
  await deleteSubscription(device);
  return json({ ok: true });
});
