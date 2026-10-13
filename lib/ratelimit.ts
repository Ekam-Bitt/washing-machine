import type { NextRequest } from "next/server";
import { store } from "./store";

/** True once this IP has made more than `max` attempts at `bucket` in the window. */
export async function tooManyTries(req: NextRequest, bucket: string, max = 10, windowS = 600) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `wm:tries:${bucket}:${ip}`;
  const n = await store().incr(key);
  if (n === 1) await store().expire(key, windowS);
  return n > max;
}
