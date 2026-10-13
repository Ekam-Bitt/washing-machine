import {
  MACHINE_IDS,
  type MachineId,
  type MachineStatus,
  type Notice,
  type PublicState,
  type QueueEntry,
  type Session,
  type State,
} from "./types";

/** How long the person at the front keeps first claim on a freed machine. */
export const RESERVE_MS = 15 * 60_000;
/** Assumed length of a wash when estimating queue waits. */
const AVG_CYCLE_MS = 45 * 60_000;
/** Time to unload one machine and load the next. */
const SWAP_MS = 5 * 60_000;

const label = (m: MachineId) => `Machine ${m}`;

export function machineStatus(s: Session | null, now: number): MachineStatus {
  if (!s || s.collectedAt) return "idle";
  return now < s.endsAt ? "running" : "done";
}

export function emptyState(): State {
  return { machines: { A: null, B: null }, queue: [] };
}

export function callFor(state: State, m: MachineId) {
  return state.queue.find((q) => q.calledFor === m) ?? null;
}

/** The queue entry holding a reservation on machine m right now, if any. */
export function activeReservation(state: State, m: MachineId, now: number) {
  const q = callFor(state, m);
  return q && q.calledAt && now - q.calledAt < RESERVE_MS ? q : null;
}

/**
 * Advances the state to `now`: notices finished cycles, and hands every freed
 * machine to the next person waiting. Mutates `state`; returns the pushes to
 * send. Running it twice in a row is a no-op, so any caller can run it.
 */
export function tick(state: State, now: number): Notice[] {
  const notices: Notice[] = [];

  for (const m of MACHINE_IDS) {
    const s = state.machines[m];
    if (s && machineStatus(s, now) === "done" && !s.notifiedDone) {
      s.notifiedDone = true;
      const waiting = state.queue.length;
      notices.push({
        deviceId: s.deviceId,
        tag: `done-${s.id}`,
        title: "Your wash is complete",
        body:
          `Come collect your clothes from ${label(m)}.` +
          (waiting ? ` ${waiting} ${waiting === 1 ? "person is" : "people are"} waiting.` : ""),
      });
    }
  }

  // A call is void once someone else has the machine running.
  for (const q of state.queue) {
    if (!q.calledFor) continue;
    const s = state.machines[q.calledFor];
    if (machineStatus(s, now) === "running" && s!.deviceId !== q.deviceId) {
      q.calledFor = undefined;
      q.calledAt = undefined;
    }
  }

  for (const m of MACHINE_IDS) {
    if (machineStatus(state.machines[m], now) === "running" || callFor(state, m)) continue;
    const next = state.queue.find((q) => !q.calledFor);
    if (!next) break;
    next.calledFor = m;
    next.calledAt = now;
    notices.push({
      deviceId: next.deviceId,
      tag: `call-${next.id}`,
      title: "You're up!",
      body:
        machineStatus(state.machines[m], now) === "done"
          ? `Previous run on ${label(m)} completed, it's your turn.`
          : `${label(m)} is free, it's your turn.`,
    });
  }

  return notices;
}

/** Estimated time each queue entry gets a machine, in queue order. */
function queueEtas(state: State, now: number): number[] {
  const free = MACHINE_IDS.map((m) => {
    const s = state.machines[m];
    return machineStatus(s, now) === "running" ? s!.endsAt + SWAP_MS : now;
  });
  return state.queue.map((q) => {
    if (q.calledFor) return now;
    free.sort((a, b) => a - b);
    const eta = Math.max(free[0], now);
    free[0] = eta + AVG_CYCLE_MS + SWAP_MS;
    return eta;
  });
}

const person = (p: { name: string; room: string; phone: string }) => ({
  name: p.name,
  room: p.room,
  phone: p.phone,
});

export function publicView(state: State, deviceId: string, now: number): PublicState {
  const etas = queueEtas(state, now);
  const mine = state.queue.findIndex((q) => q.deviceId === deviceId);
  const myEntry: QueueEntry | undefined = state.queue[mine];

  let contact = null;
  if (myEntry?.calledFor) {
    const s = state.machines[myEntry.calledFor];
    if (s && machineStatus(s, now) === "done") contact = person(s);
  }

  return {
    now,
    machines: MACHINE_IDS.map((m) => {
      const s = state.machines[m];
      const status = machineStatus(s, now);
      const r = activeReservation(state, m, now);
      return {
        id: m,
        status,
        startedAt: status === "idle" ? null : s!.startedAt,
        endsAt: status === "idle" ? null : s!.endsAt,
        mine: status !== "idle" && s!.deviceId === deviceId,
        reservedUntil: r ? r.calledAt! + RESERVE_MS : null,
        reservedForMe: r?.deviceId === deviceId,
      };
    }),
    queue: state.queue.map((q, i) => ({
      pos: i + 1,
      joinedAt: q.joinedAt,
      eta: etas[i],
      called: !!q.calledFor,
      mine: q.deviceId === deviceId,
    })),
    me: {
      sessions: MACHINE_IDS.flatMap((m) => {
        const s = state.machines[m];
        const status = machineStatus(s, now);
        if (status === "idle" || s!.deviceId !== deviceId) return [];
        return [
          {
            machine: m,
            status,
            endsAt: s!.endsAt,
            prev: s!.prev ?? null,
            waiting: state.queue.length,
          },
        ];
      }),
      queue: myEntry
        ? {
            pos: mine + 1,
            eta: etas[mine],
            calledFor: myEntry.calledFor ?? null,
            calledAt: myEntry.calledAt ?? null,
            contact,
          }
        : null,
    },
  };
}
