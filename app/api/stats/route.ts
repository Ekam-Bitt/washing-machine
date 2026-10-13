import { authed, json } from "@/lib/http";
import { currentSlot, startsByHour } from "@/lib/stats";

export const GET = authed(async () => {
  return json({ starts: await startsByHour(), now: currentSlot() });
});
