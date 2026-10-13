import { MACHINE_IDS, type MachineId, type Person } from "./types";

export class BadInput extends Error {}

/** Adds +91 to bare 10-digit Indian numbers; keeps other country codes. */
export function normalizePhone(raw: string) {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10) digits = `91${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) throw new BadInput("Enter a valid phone number");
  return `+${digits}`;
}

const text = (v: unknown, field: string, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new BadInput(`${field} is required`);
  if (s.length > max) throw new BadInput(`${field} is too long`);
  return s;
};

export function parsePerson(body: Record<string, unknown>): Person {
  return {
    name: text(body.name, "Name", 40),
    room: text(body.room, "Room", 12),
    phone: normalizePhone(text(body.phone, "Phone", 20)),
  };
}

export function parseMachine(v: unknown): MachineId {
  if (MACHINE_IDS.includes(v as MachineId)) return v as MachineId;
  throw new BadInput("Unknown machine");
}

export function parseMinutes(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 240) throw new BadInput("Minutes must be between 1 and 240");
  return Math.round(n);
}
