"use client";

import { useCallback, useEffect, useState } from "react";
import { api, clock, countdown, enablePush, minutesFromNow, pushSupport, type PushSupport } from "@/lib/client";
import type { MachineId, PublicState } from "@/lib/types";
import { ContactCard } from "./ContactCard";
import { PersonForm } from "./PersonForm";
import { PinGate } from "./PinGate";
import { WashingMachine } from "./WashingMachine";

type Machine = PublicState["machines"][number];
type Form = { kind: "start"; machine: MachineId } | { kind: "queue" } | null;

const POLL_MS = 5000;

export function Dashboard() {
  const [data, setData] = useState<PublicState | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(0);
  const [form, setForm] = useState<Form>(null);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PushSupport>("unsupported");

  const load = useCallback(async () => {
    try {
      const d: PublicState = await api("GET", "/api/state");
      setData(d);
      setNow(Date.now());
      setSkew(d.now - Date.now());
      setAuthed(true);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setAuthed(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only capabilities once on mount
    setAlerts(pushSupport());
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      load();
    }
  };

  const turnOnAlerts = async (test = false) => setAlerts(await enablePush(test).catch(() => pushSupport()));

  if (authed === false) return <PinGate onDone={load} />;
  if (!data) return <p className="p-8 text-center text-sm text-muted">Loading…</p>;

  const t = now + skew;
  const left = (m: { endsAt: number | null }) => (m.endsAt ?? t) - t;
  const startable = (m: Machine) => m.status !== "running" && (!m.reservedUntil || m.reservedForMe);
  const anyStartable = data.machines.some(startable);
  const { sessions, queue: myQueue } = data.me;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Laundry</h1>
        <p className="text-sm text-muted">Two machines on the roof. Book your turn, get a ping when it&apos;s yours.</p>
      </header>

      <section className="grid grid-cols-2 gap-3" aria-label="Machines">
        {data.machines.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!startable(m) || !!form}
            onClick={() => {
              void turnOnAlerts();
              setForm({ kind: "start", machine: m.id });
            }}
            className="group rounded-2xl border border-line/15 p-3 text-left transition enabled:hover:border-line disabled:cursor-default"
          >
            <WashingMachine
              status={m.status}
              display={m.status === "running" ? countdown(left(m)) : m.status === "done" ? "End" : ""}
              className="mx-auto max-w-[180px]"
            />
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="font-medium">Machine {m.id}</span>
              {m.mine && <span className="rounded-full border border-line px-2 text-xs">Yours</span>}
            </div>
            <MachineLine m={m} msLeft={left(m)} />
          </button>
        ))}
      </section>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-600 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-6 space-y-3">
        {sessions.map((s) => (
          <SessionCard
            key={s.machine}
            s={s}
            msLeft={s.endsAt - t}
            onAction={(action, minutes) =>
              run(() => api("PATCH", "/api/session", { machine: s.machine, action, minutes }))
            }
          />
        ))}

        {myQueue && (
          <div className="rounded-2xl border border-line p-4">
            {myQueue.calledFor ? (
              <>
                <p className="text-lg font-semibold">You&apos;re up: Machine {myQueue.calledFor}</p>
                <p className="mt-1 text-sm text-muted">
                  It&apos;s held for you until {clock(myQueue.calledAt! + 15 * 60_000)}. After that anyone can use it.
                </p>
                {myQueue.contact && (
                  <ContactCard title="Clothes still inside belong to" person={myQueue.contact} />
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    disabled={!!form}
                    onClick={() => setForm({ kind: "start", machine: myQueue.calledFor! })}
                  >
                    Start my wash
                  </button>
                  <button className="btn" onClick={() => run(() => api("DELETE", "/api/queue"))}>
                    Leave queue
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">You&apos;re #{myQueue.pos} in the queue</p>
                <p className="mt-1 text-sm text-muted">
                  Estimated around {clock(myQueue.eta)} ({minutesFromNow(myQueue.eta - t)}). We&apos;ll ping you
                  when a machine frees up.
                </p>
                <button className="btn mt-4" onClick={() => run(() => api("DELETE", "/api/queue"))}>
                  Leave queue
                </button>
              </>
            )}
          </div>
        )}

        {form?.kind === "start" && (
          <PersonForm
            title="Start a wash"
            submitLabel="Start"
            withMachine={{
              value: form.machine,
              options: data.machines.map((m) => ({ id: m.id, disabled: !startable(m), done: m.status === "done" })),
              onChange: (machine) => setForm({ kind: "start", machine }),
            }}
            onCancel={() => setForm(null)}
            onSubmit={async (p, minutes) => {
              if (await run(() => api("POST", "/api/session", { ...p, machine: form.machine, minutes }))) setForm(null);
            }}
          />
        )}

        {form?.kind === "queue" && (
          <PersonForm
            title="Join the queue"
            submitLabel="Join queue"
            onCancel={() => setForm(null)}
            onSubmit={async (p) => {
              if (await run(() => api("POST", "/api/queue", p))) setForm(null);
            }}
          />
        )}

        {!form && !myQueue && (
          <div className="flex flex-wrap gap-2">
            {anyStartable ? (
              <button
                className="btn-primary"
                onClick={() => {
                  void turnOnAlerts();
                  setForm({ kind: "start", machine: data.machines.find(startable)!.id });
                }}
              >
                Start a wash
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => {
                  void turnOnAlerts();
                  setForm({ kind: "queue" });
                }}
              >
                Join the queue
                {data.queue.length > 0 && ` · ${data.queue.length} ahead`}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Queue</h2>
        {data.queue.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nobody waiting.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line/10 rounded-2xl border border-line/15">
            {data.queue.map((q) => (
              <li key={q.pos} className={`flex items-center justify-between px-4 py-3 text-sm ${q.mine ? "font-semibold" : ""}`}>
                <span>
                  #{q.pos} {q.mine ? "You" : "Someone"}
                  <span className="ml-2 font-normal text-muted">waiting {minutesFromNow(t - q.joinedAt)}</span>
                </span>
                <span className="font-normal text-muted">{q.called ? "Called" : `~${clock(q.eta)}`}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <AlertsNote alerts={alerts} onEnable={() => turnOnAlerts(true)} />
    </main>
  );
}

function MachineLine({ m, msLeft }: { m: Machine; msLeft: number }) {
  const held = m.reservedUntil && (
    <span className="block text-xs text-muted">
      {m.reservedForMe ? "Held for you" : "Held for next in queue"} till {clock(m.reservedUntil)}
    </span>
  );
  if (m.status === "running") {
    return (
      <p className="text-sm text-muted">
        <span className="font-mono text-foreground">{countdown(msLeft)}</span> left
      </p>
    );
  }
  if (m.status === "done") {
    return (
      <p className="text-sm text-muted">
        Done, waiting for pickup{held}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted">
      Free{held}
    </p>
  );
}

function SessionCard({
  s,
  msLeft,
  onAction,
}: {
  s: PublicState["me"]["sessions"][number];
  msLeft: number;
  onAction: (action: "minutes" | "ended" | "collected", minutes?: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState("");
  return (
    <div className="rounded-2xl border border-line p-4">
      {s.status === "running" ? (
        <>
          <p className="text-lg font-semibold">
            Your wash in Machine {s.machine}: <span className="font-mono">{countdown(msLeft)}</span>
          </p>
          <p className="mt-1 text-sm text-muted">Ends around {clock(s.endsAt)}. We&apos;ll ping you when it&apos;s done.</p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold">Your wash in Machine {s.machine} is complete</p>
          <p className="mt-1 text-sm text-muted">
            Please collect your clothes
            {s.waiting > 0 && `, ${s.waiting} ${s.waiting === 1 ? "person is" : "people are"} waiting`}.
          </p>
        </>
      )}
      {s.prev && <ContactCard title="Previous load you took out belonged to" person={s.prev} />}

      {editing ? (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onAction("minutes", Number(minutes))) setEditing(false);
          }}
        >
          <label className="text-sm" htmlFor={`min-${s.machine}`}>
            Minutes left on the machine
          </label>
          <input
            id={`min-${s.machine}`}
            className="input w-24"
            inputMode="numeric"
            type="number"
            min={1}
            max={240}
            required
            autoFocus
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <button className="btn-primary">Save</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {s.status === "running" ? (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                Change time left
              </button>
              <button className="btn" onClick={() => onAction("ended")}>
                It finished early
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={() => onAction("collected")}>
              I&apos;ve collected my clothes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AlertsNote({ alerts, onEnable }: { alerts: PushSupport; onEnable: () => void }) {
  if (alerts === "granted") {
    return (
      <p className="mt-8 text-xs text-muted">
        Alerts are on for this device.{" "}
        <button className="underline" onClick={onEnable}>
          Send a test
        </button>
      </p>
    );
  }
  return (
    <div className="mt-8 rounded-2xl bg-soft p-4 text-sm">
      {alerts === "default" && (
        <>
          <p>Turn on alerts to hear when your wash is done and when it&apos;s your turn.</p>
          <button className="btn mt-3 bg-background" onClick={onEnable}>
            Turn on alerts
          </button>
        </>
      )}
      {alerts === "needs-home-screen" && (
        <p>
          On iPhone, alerts need the app on your Home Screen: tap Share, then <b>Add to Home Screen</b>, and open it
          from there.
        </p>
      )}
      {alerts === "denied" && <p>Alerts are blocked for this site. Allow notifications in your browser settings.</p>}
      {alerts === "unsupported" && <p>This browser can&apos;t show alerts. Keep this page open to follow along.</p>}
    </div>
  );
}
