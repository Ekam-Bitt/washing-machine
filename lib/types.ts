export type MachineId = "A" | "B";
export const MACHINE_IDS: MachineId[] = ["A", "B"];

export type Person = { name: string; room: string; phone: string };

export type Session = Person & {
  id: string;
  deviceId: string;
  startedAt: number;
  endsAt: number;
  collectedAt?: number;
  /** Cleared automatically after sitting done for hours; clothes may still be inside. */
  autoClearedAt?: number;
  notifiedDone?: boolean;
  remindedAt?: number;
  /** Owner of the previous load if it was still inside when this one started. */
  prev?: Person;
};

export type QueueEntry = Person & {
  id: string;
  deviceId: string;
  joinedAt: number;
  /** Set once a machine has freed up for this person. */
  calledAt?: number;
  calledFor?: MachineId;
  /** Times this person let a hold run out while others were waiting. */
  skips?: number;
};

export type Broken = { note: string; at: number };

export type State = {
  machines: Record<MachineId, Session | null>;
  queue: QueueEntry[];
  broken?: Partial<Record<MachineId, Broken>>;
  /** Recent bookings per person (`d:<device>` / `p:<phone>`), for cooldowns. */
  bookings?: Record<string, { count: number; last: number; until?: number }>;
  /** Wake-up times (unix seconds) already handed to QStash. */
  scheduled?: number[];
};

export type MachineStatus = "idle" | "running" | "done";

export type Notice = { deviceId: string; title: string; body: string; tag: string };

/** What GET /api/state returns. Contains no personal data except inside `me`. */
export type PublicState = {
  now: number;
  machines: {
    id: MachineId;
    status: MachineStatus;
    startedAt: number | null;
    endsAt: number | null;
    mine: boolean;
    reservedUntil: number | null;
    reservedForMe: boolean;
    broken: Broken | null;
  }[];
  /** `eta` is null while both machines are out of order. */
  queue: { pos: number; joinedAt: number; eta: number | null; called: boolean; mine: boolean }[];
  me: {
    /** How much of the booking allowance this device has left. */
    booking: { held: number; max: number; cooldownUntil: number | null };
    sessions: {
      machine: MachineId;
      status: MachineStatus;
      endsAt: number;
      prev: Person | null;
      waiting: number;
    }[];
    queue: {
      pos: number;
      eta: number | null;
      calledFor: MachineId | null;
      calledAt: number | null;
      /** Owner whose clothes are still in the machine you've been called for. */
      contact: Person | null;
    } | null;
  };
};
