"use client";

import { useCallback, useEffect, useState } from "react";
import { api, clock } from "@/lib/client";
import type { Broken, MachineId, MachineStatus } from "@/lib/types";

type AdminState = {
  now: number;
  pin: string;
  machines: {
    id: MachineId;
    status: MachineStatus;
    broken: Broken | null;
    session: { name: string; room: string; phone: string; endsAt: number } | null;
  }[];
  queue: { id: string; name: string; room: string; phone: string; joinedAt: number; calledFor: MachineId | null }[];
};

const STATUS: Record<MachineStatus, string> = { idle: "Free", running: "Running", done: "Done, waiting for pickup" };

export function AdminPanel() {
  const [data, setData] = useState<AdminState | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api("GET", "/api/admin"));
      setAuthed(true);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setAuthed(false);
      else setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the fetch resolves
    load();
  }, [load]);

  const act = async (payload: Record<string, unknown>, done?: string) => {
    setError(null);
    setNotice(null);
    try {
      await api("POST", "/api/admin", payload);
      if (done) setNotice(done);
    } catch (e) {
      setError((e as Error).message);
    }
    load();
  };

  if (authed === false) return <AdminLogin onDone={load} />;
  if (!data) return <p className="p-8 text-center text-sm text-muted">Loading…</p>;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-8">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laundry admin</h1>
          <p className="text-sm text-muted">Fix stuck machines and the queue, and manage access.</p>
        </div>
        <button className="btn" onClick={load}>
          Refresh
        </button>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-600 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && <p className="mb-4 rounded-xl bg-soft px-3 py-2 text-sm">{notice}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Machines</h2>
        {data.machines.map((m) => (
          <div key={m.id} className="rounded-2xl border border-line/15 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">Machine {m.id}</p>
              <p className="text-sm text-muted">
                {m.broken ? "Out of order" : STATUS[m.status]}
                {m.status === "running" && m.session && ` until ${clock(m.session.endsAt)}`}
              </p>
            </div>
            {m.broken?.note && <p className="mt-1 text-sm text-muted">“{m.broken.note}”</p>}
            {m.session && (
              <p className="mt-2 text-sm">
                {m.session.name} · Room {m.session.room} · <span className="font-mono">{m.session.phone}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {m.session && (
                <button
                  className="btn"
                  onClick={() =>
                    confirm(`Clear Machine ${m.id}? ${m.session!.name}'s wash will be removed.`) &&
                    act({ action: "clear", machine: m.id }, `Machine ${m.id} cleared.`)
                  }
                >
                  Clear machine
                </button>
              )}
              <button
                className="btn"
                onClick={() => act({ action: m.broken ? "working" : "broken", machine: m.id })}
              >
                {m.broken ? "Mark as working" : "Mark out of order"}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Queue</h2>
        {data.queue.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nobody waiting.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line/10 rounded-2xl border border-line/15">
            {data.queue.map((q, i) => (
              <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    #{i + 1} {q.name} · Room {q.room}
                  </p>
                  <p className="text-muted">
                    <span className="font-mono">{q.phone}</span> · joined {clock(q.joinedAt)}
                    {q.calledFor && ` · called for ${q.calledFor}`}
                  </p>
                </div>
                <button
                  className="btn shrink-0"
                  onClick={() => confirm(`Remove ${q.name} from the queue?`) && act({ action: "remove", id: q.id })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Access</h2>
        <PinForm current={data.pin} onSave={(pin) => act({ action: "pin", pin }, `Building PIN changed to ${pin}.`)} />
        <div className="rounded-2xl border border-line/15 p-4">
          <p className="font-semibold">Sign everyone out</p>
          <p className="mt-1 text-sm text-muted">
            Every phone has to enter the building PIN again. Use this after changing a PIN that leaked. Washes and the
            queue are kept.
          </p>
          <button
            className="btn mt-3"
            onClick={() =>
              confirm("Sign every device out?") &&
              act({ action: "sign-out-all" }, "Everyone is signed out. It can take up to 30 seconds to apply everywhere.")
            }
          >
            Sign everyone out
          </button>
        </div>
        <button
          className="text-sm text-muted underline"
          onClick={async () => {
            await api("DELETE", "/api/admin/auth").catch(() => {});
            setAuthed(false);
          }}
        >
          Leave admin
        </button>
      </section>
    </main>
  );
}

function PinForm({ current, onSave }: { current: string; onSave: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  return (
    <form
      className="rounded-2xl border border-line/15 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(pin);
        setPin("");
      }}
    >
      <p className="font-semibold">
        Building PIN: <span className="font-mono">{current}</span>
      </p>
      <p className="mt-1 text-sm text-muted">Phones that already entered the old PIN stay signed in.</p>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="New building PIN"
          className="input w-32 font-mono"
          inputMode="numeric"
          pattern="\d{4,8}"
          minLength={4}
          maxLength={8}
          required
          placeholder="New PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn-primary">Change PIN</button>
      </div>
    </form>
  );
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="mx-auto flex w-full max-w-xs flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-center text-2xl font-semibold tracking-tight">Laundry admin</h1>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await api("POST", "/api/admin/auth", { pin });
            onDone();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input
          aria-label="Admin PIN"
          className="input w-full text-center font-mono text-2xl tracking-[0.4em]"
          inputMode="numeric"
          type="password"
          required
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        {error && (
          <p role="alert" className="text-center text-sm text-red-700">
            {error}
          </p>
        )}
        <button className="btn-primary w-full">Continue</button>
      </form>
    </main>
  );
}
