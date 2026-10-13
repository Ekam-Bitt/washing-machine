import { joinQueue, leaveQueue } from "@/lib/actions";
import { authed, body, json } from "@/lib/http";
import { parsePerson } from "@/lib/validate";

export const POST = authed(async (req, device) => {
  await joinQueue(device, parsePerson(await body(req)));
  return json({ ok: true });
});

export const DELETE = authed(async (_req, device) => {
  await leaveQueue(device);
  return json({ ok: true });
});
