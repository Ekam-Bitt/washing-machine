import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const COOKIE = "wm_device";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV !== "production") return "dev-secret";
  throw new Error("SESSION_SECRET is not set");
}

const sign = (id: string) => createHmac("sha256", secret()).update(id).digest("base64url");

export function issueDevice() {
  const id = crypto.randomUUID();
  return { id, cookie: `${id}.${sign(id)}` };
}

/** The signed-in device id, or null if the cookie is missing or forged. */
export function deviceId(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  const [id, mac] = raw.split(".");
  if (!id || !mac) return null;
  const want = Buffer.from(sign(id));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

export function pinMatches(pin: string) {
  const want = Buffer.from(process.env.BUILDING_PIN || (process.env.NODE_ENV !== "production" ? "0000" : ""));
  const got = Buffer.from(pin);
  return want.length > 0 && want.length === got.length && timingSafeEqual(want, got);
}
