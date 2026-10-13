import type { NextRequest } from "next/server";
import { COOKIE, deviceId, issueDevice, pinMatches } from "@/lib/auth";
import { body, json } from "@/lib/http";
import { tooManyTries } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (await deviceId(req)) return json({ ok: true });
  if (await tooManyTries(req, "pin")) return json({ error: "Too many tries. Wait 10 minutes." }, 429);

  const { pin } = await body(req);
  if (typeof pin !== "string" || !(await pinMatches(pin.trim()))) return json({ error: "Wrong PIN" }, 401);

  const { cookie } = await issueDevice();
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
