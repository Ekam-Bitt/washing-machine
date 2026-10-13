import { collected, endedEarly, setMinutesLeft, startWash } from "@/lib/actions";
import { authed, body, json } from "@/lib/http";
import { BadInput, parseMachine, parseMinutes, parsePerson } from "@/lib/validate";

/** Start a wash. */
export const POST = authed(async (req, device) => {
  const b = await body(req);
  await startWash(device, parseMachine(b.machine), parseMinutes(b.minutes), parsePerson(b));
  return json({ ok: true });
});

/** Change your running wash: { machine, action: "minutes" | "ended" | "collected", minutes? } */
export const PATCH = authed(async (req, device) => {
  const b = await body(req);
  const m = parseMachine(b.machine);
  if (b.action === "minutes") await setMinutesLeft(device, m, parseMinutes(b.minutes));
  else if (b.action === "ended") await endedEarly(device, m);
  else if (b.action === "collected") await collected(device, m);
  else throw new BadInput("Unknown action");
  return json({ ok: true });
});
