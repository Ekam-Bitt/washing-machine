export type MachineId = "A" | "B";
export const MACHINE_IDS: MachineId[] = ["A", "B"];

export type Person = { name: string; room: string; phone: string };

export type Session = Person & {
  id: string;
  deviceId: string;
  startedAt: number;
  endsAt: number;
  collectedAt?: number;
  notifiedDone?: boolean;
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
};

export type State = {
  machines: Record<MachineId, Session | null>;
  queue: QueueEntry[];
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
  }[];
  queue: { pos: number; joinedAt: number; eta: number; called: boolean; mine: boolean }[];
  me: {
    sessions: {
      machine: MachineId;
      status: MachineStatus;
      endsAt: number;
      prev: Person | null;
      waiting: number;
    }[];
    queue: {
      pos: number;
      eta: number;
      calledFor: MachineId | null;
      calledAt: number | null;
      /** Owner whose clothes are still in the machine you've been called for. */
      contact: Person | null;
    } | null;
  };
};
