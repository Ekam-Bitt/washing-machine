import { activeReservation, callFor, isBroken, machineStatus, RESERVE_MS } from "./status";
import { recordStart } from "./stats";
import { Conflict, mutate } from "./store";
import type { MachineId, Person, State } from "./types";

const label = (m: MachineId) => `Machine ${m}`;
const clock = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export async function startWash(deviceId: string, m: MachineId, minutes: number, who: Person) {
  const { now: startedAt } = await mutate((state, now, notices) => {
    const old = state.machines[m];
    if (isBroken(state, m)) throw new Conflict(`${label(m)} is marked out of order. Mark it as working first.`);
    if (machineStatus(old, now) === "running") throw new Conflict(`${label(m)} is still running`);

    const r = activeReservation(state, m, now);
    if (r && r.deviceId !== deviceId) {
      throw new Conflict(
        `${label(m)} is held for the next person in the queue until ${clock(r.calledAt! + RESERVE_MS)}`,
      );
    }

    // Clothes are still inside unless the owner said they collected them.
    const leftover =
      old && (machineStatus(old, now) === "done" || (old.autoClearedAt && !old.collectedAt)) ? old : null;
    if (leftover && leftover.deviceId !== deviceId) {
      notices.push({
        deviceId: leftover.deviceId,
        tag: `moved-${leftover.id}`,
        title: "Your clothes were taken out",
        body: `${who.name} (Room ${who.room}) took your clothes out of ${label(m)} to start their wash.`,
      });
    }

    state.queue = state.queue.filter((q) => q.deviceId !== deviceId);
    state.machines[m] = {
      id: crypto.randomUUID(),
      deviceId,
      ...who,
      startedAt: now,
      endsAt: now + minutes * 60_000,
      prev:
        leftover && leftover.deviceId !== deviceId
          ? { name: leftover.name, room: leftover.room, phone: leftover.phone }
          : undefined,
    };
  });
  await recordStart(startedAt);
}

function ownSession(state: State, m: MachineId, deviceId: string, now: number) {
  const s = state.machines[m];
  if (!s || machineStatus(s, now) === "idle" || s.deviceId !== deviceId) {
    throw new Conflict(`You don't have a wash in ${label(m)}`);
  }
  return s;
}

/** The display on the machine changed: reset the countdown to `minutes` from now. */
export async function setMinutesLeft(deviceId: string, m: MachineId, minutes: number) {
  await mutate((state, now) => {
    const s = ownSession(state, m, deviceId, now);
    s.endsAt = now + minutes * 60_000;
    s.notifiedDone = false;
    s.remindedAt = undefined;
  });
}

/** Cycle finished before the timer did. Clothes are still inside. */
export async function endedEarly(deviceId: string, m: MachineId) {
  await mutate((state, now) => {
    const s = ownSession(state, m, deviceId, now);
    if (s.endsAt > now) s.endsAt = now;
    // The owner is the one telling us, so they don't need the "complete" push.
    s.notifiedDone = true;
  });
}

export async function collected(deviceId: string, m: MachineId) {
  await mutate((state, now, notices) => {
    const s = ownSession(state, m, deviceId, now);
    const wasDone = machineStatus(s, now) === "done";
    s.collectedAt = now;
    const q = callFor(state, m);
    if (q && wasDone) {
      notices.push({
        deviceId: q.deviceId,
        tag: `empty-${q.id}`,
        title: `${label(m)} is empty`,
        body: "The previous clothes have been collected. It's all yours.",
      });
    }
  });
}

export async function joinQueue(deviceId: string, who: Person) {
  await mutate((state, now) => {
    const mine = state.queue.find((q) => q.deviceId === deviceId);
    if (mine) {
      Object.assign(mine, who);
      return;
    }
    state.queue.push({ id: crypto.randomUUID(), deviceId, ...who, joinedAt: now });
  });
}

export async function leaveQueue(deviceId: string) {
  await mutate((state) => {
    state.queue = state.queue.filter((q) => q.deviceId !== deviceId);
  });
}

/** Anyone can flag a machine as broken, or as working again. */
export async function setBroken(m: MachineId, broken: boolean, note = "") {
  await mutate((state, now) => {
    state.broken ??= {};
    if (broken) state.broken[m] = { note, at: now };
    else delete state.broken[m];
  });
}

/** Admin: empty a machine regardless of who is using it. */
export async function adminClearMachine(m: MachineId) {
  await mutate((state) => {
    state.machines[m] = null;
  });
}

/** Admin: take someone off the queue. */
export async function adminRemoveFromQueue(id: string) {
  await mutate((state) => {
    state.queue = state.queue.filter((q) => q.id !== id);
  });
}
