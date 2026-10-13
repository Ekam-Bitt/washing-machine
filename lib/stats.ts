import { store } from "./store";

const KEY = "wm:stats:starts";

/** Day of week (0 = Sunday) and hour in India time. */
function slot(t: number) {
  const ist = new Date(t + 5.5 * 60 * 60_000);
  return { dow: ist.getUTCDay(), hour: ist.getUTCHours() };
}

/** Counts a wash starting at `t`. No personal data is kept, only the hour. */
export async function recordStart(t: number) {
  const { dow, hour } = slot(t);
  await store()
    .hincrby(KEY, `${dow}:${hour}`, 1)
    .catch((err) => console.error("stats failed", err));
}

/** Washes started, as [day of week][hour of day]. */
export async function startsByHour(): Promise<number[][]> {
  const raw = (await store().hgetall<Record<string, number>>(KEY)) ?? {};
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const [k, v] of Object.entries(raw)) {
    const [d, h] = k.split(":").map(Number);
    if (grid[d]?.[h] !== undefined) grid[d][h] = Number(v);
  }
  return grid;
}

export function currentSlot() {
  return slot(Date.now());
}
