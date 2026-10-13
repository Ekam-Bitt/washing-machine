import type { NextRequest } from "next/server";
import { COOKIE, deviceId, issueDevice, pinMatches } from "@/lib/auth";
import { body, json } from "@/lib/http";
import { store } from "@/lib/store";

const MAX_TRIES = 10;
const WINDOW_S = 10 * 60;

export async function POST(req: NextRequest) {
  if (deviceId(req)) return json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `wm:pin-tries:${ip}`;
  const tries = await store().incr(key);
  if (tries === 1) await store().expire(key, WINDOW_S);
  if (tries > MAX_TRIES) return json({ error: "Too many tries. Wait 10 minutes." }, 429);

  const { pin } = await body(req);
  if (typeof pin !== "string" || !pinMatches(pin.trim())) return json({ error: "Wrong PIN" }, 401);

  const { cookie } = issueDevice();
  const res = json({ ok: true });
  res.cookies.set(COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
