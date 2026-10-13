import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminPinMatches, isAdmin, issueAdmin } from "@/lib/auth";
import { body, json } from "@/lib/http";
import { tooManyTries } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (isAdmin(req)) return json({ ok: true });
  if (await tooManyTries(req, "admin", 5)) return json({ error: "Too many tries. Wait 10 minutes." }, 429);

  const { pin } = await body(req);
  if (typeof pin !== "string" || !adminPinMatches(pin.trim())) return json({ error: "Wrong admin PIN" }, 401);

  const { cookie, maxAge } = issueAdmin();
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
