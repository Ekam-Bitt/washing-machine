import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { buildingPin, getConfig } from "./config";

export const COOKIE = "wm_device";
export const ADMIN_COOKIE = "wm_admin";
const ADMIN_TTL_MS = 30 * 24 * 60 * 60_000;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV !== "production") return "dev-secret";
  throw new Error("SESSION_SECRET is not set");
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

// Cookie is `id.mac` for epoch 0 (the original format) and `id.epoch.mac` after a sign-out-all.
const devicePayload = (id: string, epoch: number) => (epoch ? `${id}.${epoch}` : id);

export async function issueDevice() {
  const { epoch } = await getConfig();
  const id = crypto.randomUUID();
  return { id, cookie: `${devicePayload(id, epoch)}.${sign(devicePayload(id, epoch))}` };
}

/** The signed-in device id, or null if the cookie is missing, forged or signed out. */
export async function deviceId(req: NextRequest): Promise<string | null> {
  const parts = req.cookies.get(COOKIE)?.value.split(".") ?? [];
  if (parts.length !== 2 && parts.length !== 3) return null;
  const id = parts[0];
  const epoch = parts.length === 3 ? Number(parts[1]) : 0;
  const mac = parts[parts.length - 1];
  if (!same(sign(devicePayload(id, epoch)), mac)) return null;
  return epoch === (await getConfig()).epoch ? id : null;
}

export async function pinMatches(pin: string) {
  return same(await buildingPin(), pin);
}

export function adminPinMatches(pin: string) {
  return same(process.env.ADMIN_PIN || (process.env.NODE_ENV !== "production" ? "000000" : ""), pin);
}

export function issueAdmin() {
  const exp = Date.now() + ADMIN_TTL_MS;
  return { cookie: `${exp}.${sign(`admin:${exp}`)}`, maxAge: ADMIN_TTL_MS / 1000 };
}

export function isAdmin(req: NextRequest) {
  const [exp, mac] = req.cookies.get(ADMIN_COOKIE)?.value.split(".") ?? [];
  return !!exp && !!mac && Number(exp) > Date.now() && same(sign(`admin:${exp}`), mac);
}
