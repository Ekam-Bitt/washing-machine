import { NextResponse, type NextRequest } from "next/server";
import { deviceId, isAdmin } from "./auth";
import { Conflict } from "./store";
import { BadInput } from "./validate";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

async function guard(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BadInput) return json({ error: err.message }, 400);
    if (err instanceof Conflict) return json({ error: err.message }, 409);
    console.error(err);
    return json({ error: "Something went wrong" }, 500);
  }
}

/** Wraps a route that needs a signed-in device and turns known errors into 4xx. */
export function authed(fn: (req: NextRequest, device: string) => Promise<Response>) {
  return async (req: NextRequest) => {
    const device = await deviceId(req);
    if (!device) return json({ error: "Enter the building PIN first" }, 401);
    return guard(() => fn(req, device));
  };
}

/** Same as `authed`, for the admin page. */
export function adminOnly(fn: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    if (!isAdmin(req)) return json({ error: "Enter the admin PIN first" }, 401);
    return guard(() => fn(req));
  };
}

export async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}
