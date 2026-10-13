import { setBroken } from "@/lib/actions";
import { authed, body, json } from "@/lib/http";
import { BadInput, parseMachine } from "@/lib/validate";

/** Flag a machine out of order or working again: { machine, broken, note? } */
export const PATCH = authed(async (req) => {
  const b = await body(req);
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > 80) throw new BadInput("Keep the note under 80 characters");
  await setBroken(parseMachine(b.machine), b.broken === true, note);
  return json({ ok: true });
});
