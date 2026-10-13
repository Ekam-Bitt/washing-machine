import { Receiver } from "@upstash/qstash";
import type { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { mutate } from "@/lib/store";

/** Called by QStash when a cycle is due to finish. Just brings the state up to date. */
export async function POST(req: NextRequest) {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) return json({ error: "QStash is not configured" }, 503);

  const raw = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";
  const valid = await new Receiver({ currentSigningKey: current, nextSigningKey: next })
    .verify({ signature, body: raw })
    .catch(() => false);
  if (!valid) return json({ error: "Bad signature" }, 401);

  await mutate(() => null);
  return json({ ok: true });
}
