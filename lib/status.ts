import { cooldownUntil, held, MAX_HELD, phonesOf } from "./limits";
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
/** Nudge the owner if their finished clothes are still inside after this while someone waits. */
export const REMIND_MS = 10 * 60_000;
/** A finished wash nobody marked as collected goes back to Free after this. */
export const STALE_MS = 3 * 60 * 60_000;
/** Letting this many holds run out while others wait drops you from the queue. */
const MAX_SKIPS = 2;
/** Assumed length of a wash when estimating queue waits. */
const AVG_CYCLE_MS = 45 * 60_000;
/** Time to unload one machine and load the next. */
const SWAP_MS = 5 * 60_000;

const label = (m: MachineId) => `Machine ${m}`;

export function machineStatus(s: Session | null, now: number): MachineStatus {
  if (!s || s.collectedAt || s.autoClearedAt) return "idle";
  return now < s.endsAt ? "running" : "done";
}

export function emptyState(): State {
  return { machines: { A: null, B: null }, queue: [] };
}

export const isBroken = (state: State, m: MachineId) => !!state.broken?.[m];

export function callFor(state: State, m: MachineId) {
  return state.queue.find((q) => q.calledFor === m) ?? null;
}

/** The queue entry holding a reservation on machine m right now, if any. */
export function activeReservation(state: State, m: MachineId, now: number) {
  const q = callFor(state, m);
  return q && q.calledAt && now - q.calledAt < RESERVE_MS ? q : null;
}

/**
 * Advances the state to `now`: notices finished cycles, nudges owners who
 * haven't collected, moves people who let their hold run out, and hands every
 * freed machine to the next person waiting. Mutates `state`; returns the
 * pushes to send. Running it twice in a row is a no-op, so any caller can.
 */
export function tick(state: State, now: number): Notice[] {
  const notices: Notice[] = [];

  for (const m of MACHINE_IDS) {
    const s = state.machines[m];
    if (!s || machineStatus(s, now) !== "done") continue;
    const waiting = state.queue.length;

    if (!s.notifiedDone) {
      s.notifiedDone = true;
      notices.push({
        deviceId: s.deviceId,
        tag: `done-${s.id}`,
        title: "Your wash is complete",
        body:
          `Come collect your clothes from ${label(m)}.` +
          (waiting ? ` ${waiting} ${waiting === 1 ? "person is" : "people are"} waiting.` : ""),
      });
    }

    if (!s.remindedAt && waiting > 0 && now >= s.endsAt + REMIND_MS) {
      s.remindedAt = now;
      notices.push({
        deviceId: s.deviceId,
        tag: `remind-${s.id}`,
        title: "Someone is waiting for your machine",
        body: `Your clothes are still in ${label(m)}. Please collect them.`,
      });
    }

    if (now >= s.endsAt + STALE_MS) s.autoClearedAt = now;
  }

  // A call is void once someone else has the machine running, or it breaks.
  for (const q of state.queue) {
    if (!q.calledFor) continue;
    const s = state.machines[q.calledFor];
    const takenByOther = machineStatus(s, now) === "running" && s!.deviceId !== q.deviceId;
    if (takenByOther || isBroken(state, q.calledFor)) {
      q.calledFor = undefined;
      q.calledAt = undefined;
    }
  }

  // Let the next person go ahead of anyone whose hold ran out. Nobody else
  // waiting means nobody is held up, so the hold stays.
  for (const q of [...state.queue]) {
    if (!q.calledFor || !q.calledAt || now - q.calledAt < RESERVE_MS) continue;
    const i = state.queue.indexOf(q);
    const next = state.queue.findIndex((o, j) => j > i && !o.calledFor);
    if (next === -1) continue;
    const m = q.calledFor;
    q.calledFor = undefined;
    q.calledAt = undefined;
    q.skips = (q.skips ?? 0) + 1;
    state.queue.splice(i, 1);
    if (q.skips >= MAX_SKIPS) {
      notices.push({
        deviceId: q.deviceId,
        tag: `skip-${q.id}`,
        title: "Removed from the queue",
        body: `You missed your turn on ${label(m)} twice, so you've been taken off the queue. Join again any time.`,
      });
    } else {
      // `next` was counted with q still in the list, so this lands right behind that person.
      state.queue.splice(next, 0, q);
      notices.push({
        deviceId: q.deviceId,
        tag: `skip-${q.id}`,
        title: "You missed your turn",
        body: `Your hold on ${label(m)} ran out, so the next person went ahead. You're still in the queue.`,
      });
    }
  }

  for (const m of MACHINE_IDS) {
    if (isBroken(state, m) || machineStatus(state.machines[m], now) === "running" || callFor(state, m)) continue;
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

/** Future moments when `tick` would do something without anyone making a request. */
export function wakeups(state: State, now: number): number[] {
  const times: number[] = [];
  for (const m of MACHINE_IDS) {
    const s = state.machines[m];
    const status = machineStatus(s, now);
    if (status === "running") times.push(s!.endsAt);
    if (status !== "idle" && !s!.remindedAt && state.queue.length) times.push(s!.endsAt + REMIND_MS);
  }
  for (const q of state.queue) if (q.calledAt) times.push(q.calledAt + RESERVE_MS);
  return times.filter((t) => t > now);
}

/** Estimated time each queue entry gets a machine, in queue order. */
function queueEtas(state: State, now: number): (number | null)[] {
  const free = MACHINE_IDS.filter((m) => !isBroken(state, m)).map((m) => {
    const s = state.machines[m];
    return machineStatus(s, now) === "running" ? s!.endsAt + SWAP_MS : now;
  });
  return state.queue.map((q) => {
    if (q.calledFor) return now;
    if (!free.length) return null;
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
        broken: state.broken?.[m] ?? null,
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
      booking: (() => {
        const phones = phonesOf(state, deviceId);
        return {
          held: held(state, deviceId, phones, now),
          max: MAX_HELD,
          cooldownUntil: cooldownUntil(state, deviceId, phones, now),
        };
      })(),
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
