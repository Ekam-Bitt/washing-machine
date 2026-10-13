import { authed, json } from "@/lib/http";
import { publicView } from "@/lib/status";
import { freshState } from "@/lib/store";

export const GET = authed(async (_req, device) => {
  const { state, now } = await freshState();
  return json(publicView(state, device, now));
});
