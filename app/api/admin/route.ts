import { adminClearMachine, adminRemoveFromQueue, setBroken } from "@/lib/actions";
import { buildingPin, updateConfig } from "@/lib/config";
import { adminOnly, body, json } from "@/lib/http";
import { machineStatus } from "@/lib/status";
import { freshState } from "@/lib/store";
import { MACHINE_IDS } from "@/lib/types";
import { BadInput, parseMachine } from "@/lib/validate";

/** Everything, including names and phone numbers. Admin only. */
export const GET = adminOnly(async () => {
  const { state, now } = await freshState();
  return json({
    now,
    pin: await buildingPin(),
    machines: MACHINE_IDS.map((m) => {
      const s = state.machines[m];
      const status = machineStatus(s, now);
      return {
        id: m,
        status,
        broken: state.broken?.[m] ?? null,
        session: s && status !== "idle" ? { name: s.name, room: s.room, phone: s.phone, endsAt: s.endsAt } : null,
      };
    }),
    queue: state.queue.map((q) => ({
      id: q.id,
      name: q.name,
      room: q.room,
      phone: q.phone,
      joinedAt: q.joinedAt,
      calledFor: q.calledFor ?? null,
    })),
  });
});

/** { action: "clear" | "broken" | "working", machine } | { action: "remove", id } | { action: "pin", pin } | { action: "sign-out-all" } */
export const POST = adminOnly(async (req) => {
  const b = await body(req);
  switch (b.action) {
    case "clear":
      await adminClearMachine(parseMachine(b.machine));
      break;
    case "broken":
    case "working":
      await setBroken(parseMachine(b.machine), b.action === "broken", typeof b.note === "string" ? b.note.slice(0, 80) : "");
      break;
    case "remove":
      if (typeof b.id !== "string") throw new BadInput("Missing queue entry");
      await adminRemoveFromQueue(b.id);
      break;
    case "pin": {
      const pin = typeof b.pin === "string" ? b.pin.trim() : "";
      if (!/^\d{4,8}$/.test(pin)) throw new BadInput("PIN must be 4 to 8 digits");
      await updateConfig({ pin });
      break;
    }
    case "sign-out-all":
      await updateConfig((c) => ({ epoch: c.epoch + 1 }));
      break;
    default:
      throw new BadInput("Unknown action");
  }
  return json({ ok: true });
});
