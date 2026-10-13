import { Redis } from "@upstash/redis";
import { emptyState, tick } from "./status";
import type { Notice, State } from "./types";
import { sendNotices } from "./push";

const STATE_KEY = "wm:state";
const LOCK_KEY = "wm:lock";

type KV = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { nx?: true; px?: number; ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

/** Stand-in for local development before Redis is configured. */
function memoryKV(): KV {
  const g = globalThis as unknown as { __wmKV?: Map<string, { v: unknown; exp?: number }> };
  const m = (g.__wmKV ??= new Map());
  const live = (k: string) => {
    const e = m.get(k);
    if (e?.exp && e.exp < Date.now()) m.delete(k);
    return m.get(k);
  };
  return {
    async get<T>(k: string) {
      const e = live(k);
      return e ? (structuredClone(e.v) as T) : null;
    },
    async set(k, v, o) {
      if (o?.nx && live(k)) return null;
      const ms = o?.px ?? (o?.ex ? o.ex * 1000 : undefined);
      m.set(k, { v: structuredClone(v), exp: ms ? Date.now() + ms : undefined });
      return "OK";
    },
    async del(k) {
      m.delete(k);
    },
    async incr(k) {
      const e = live(k);
      const n = Number(e?.v ?? 0) + 1;
      m.set(k, { v: n, exp: e?.exp });
      return n;
    },
    async expire(k, s) {
      const e = live(k);
      if (e) e.exp = Date.now() + s * 1000;
    },
  };
}

let kv: KV | undefined;
export function store(): KV {
  if (kv) return kv;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  if (url) {
    kv = Redis.fromEnv() as unknown as KV;
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("No Redis configured, using in-memory store");
    kv = memoryKV();
  } else {
    throw new Error("Redis is not configured (KV_REST_API_URL / UPSTASH_REDIS_REST_URL)");
  }
  return kv;
}

export async function readState(): Promise<State> {
  return (await store().get<State>(STATE_KEY)) ?? emptyState();
}

export class Conflict extends Error {}

/**
 * Runs `fn` on the latest state under a lock, with `tick` run before and
 * after it. Writes the result back and sends any pushes produced.
 * `fn` can throw `Conflict` to reject the request without writing.
 */
export async function mutate<T>(
  fn: (state: State, now: number, notices: Notice[]) => T,
): Promise<{ state: State; result: T; now: number }> {
  const kvs = store();
  const token = crypto.randomUUID();
  for (let i = 0; ; i++) {
    if (await kvs.set(LOCK_KEY, token, { nx: true, px: 5000 })) break;
    if (i > 50) throw new Error("State is busy, try again");
    await new Promise((r) => setTimeout(r, 100));
  }
  let notices: Notice[];
  let out: { state: State; result: T; now: number };
  try {
    const state = await readState();
    const now = Date.now();
    notices = tick(state, now);
    const result = fn(state, now, notices);
    // The change may have freed a machine for the next person in the queue.
    notices.push(...tick(state, now));
    await kvs.set(STATE_KEY, state);
    out = { state, result, now };
  } finally {
    if ((await kvs.get(LOCK_KEY)) === token) await kvs.del(LOCK_KEY);
  }
  await sendNotices(notices);
  return out;
}

/** Brings the stored state up to date, taking the lock only if something changed. */
export async function freshState(): Promise<{ state: State; now: number }> {
  const state = await readState();
  const now = Date.now();
  const probe = structuredClone(state);
  if (tick(probe, now).length === 0 && JSON.stringify(probe) === JSON.stringify(state)) {
    return { state, now };
  }
  const r = await mutate(() => null);
  return { state: r.state, now: r.now };
}
