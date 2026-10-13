import { machineStatus } from "./status";
import { Conflict } from "./errors";
import { MACHINE_IDS, type State } from "./types";

/** Washes in progress plus queue spots one person can hold at once. */
export const MAX_HELD = 2;
/** After the MAX_HELD-th booking, no new bookings for this long. */
export const COOLDOWN_MS = 60 * 60_000;
/** Bookings older than this no longer count towards a cooldown. */
const MEMORY_MS = 3 * 60 * 60_000;

/**
 * A person is tracked both by device and by phone number, so switching
 * browsers or going incognito with the same number doesn't reset the limits.
 */
const keys = (deviceId: string, phones: string[]) => [`d:${deviceId}`, ...phones.map((p) => `p:${p}`)];

const isTheirs = (x: { deviceId: string; phone: string }, deviceId: string, phones: string[]) =>
  x.deviceId === deviceId || phones.includes(x.phone);

/** Washes in progress (including finished ones not yet collected) and queue spots. */
export function held(state: State, deviceId: string, phones: string[], now: number) {
  const sessions = MACHINE_IDS.filter((m) => {
    const s = state.machines[m];
    return s && machineStatus(s, now) !== "idle" && isTheirs(s, deviceId, phones);
  }).length;
  return sessions + state.queue.filter((q) => isTheirs(q, deviceId, phones)).length;
}

/** When this person may book again, or null if they can book now. */
export function cooldownUntil(state: State, deviceId: string, phones: string[], now: number) {
  const latest = Math.max(0, ...keys(deviceId, phones).map((k) => state.bookings?.[k]?.until ?? 0));
  return latest > now ? latest : null;
}

/** The phone numbers this device has used for its current washes and queue spot. */
export function phonesOf(state: State, deviceId: string) {
  const phones = new Set<string>();
  for (const m of MACHINE_IDS) {
    const s = state.machines[m];
    if (s?.deviceId === deviceId) phones.add(s.phone);
  }
  for (const q of state.queue) if (q.deviceId === deviceId) phones.add(q.phone);
  return [...phones];
}

const clock = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Throws if this person can't take another wash or queue spot right now. */
export function assertCanBook(state: State, deviceId: string, phone: string, now: number) {
  const phones = [...new Set([phone, ...phonesOf(state, deviceId)])];
  if (held(state, deviceId, phones, now) >= MAX_HELD) {
    throw new Conflict(
      `You already have ${MAX_HELD} bookings. Collect a finished load or leave the queue before booking again.`,
    );
  }
  const until = cooldownUntil(state, deviceId, phones, now);
  if (until) throw new Conflict(`You've used your ${MAX_HELD} bookings. You can book again at ${clock(until)}.`);
}

export function recordBooking(state: State, deviceId: string, phone: string, now: number) {
  const b = (state.bookings ??= {});
  for (const key of keys(deviceId, [phone])) {
    const r = (b[key] ??= { count: 0, last: 0 });
    if (now - r.last > MEMORY_MS) r.count = 0;
    r.count += 1;
    r.last = now;
    if (r.count >= MAX_HELD) {
      r.until = now + COOLDOWN_MS;
      r.count = 0;
    }
  }
  for (const [key, r] of Object.entries(b)) {
    if (now - r.last > MEMORY_MS && (r.until ?? 0) < now) delete b[key];
  }
}
