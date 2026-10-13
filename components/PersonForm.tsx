"use client";

import { useState } from "react";
import { loadProfile, saveProfile } from "@/lib/client";
import type { MachineId, Person } from "@/lib/types";

const PRESETS = [15, 30, 45, 60, 90];

/** Name / room / phone form, with machine and minutes when starting a wash. */
export function PersonForm({
  title,
  submitLabel,
  withMachine,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  withMachine?: {
    value: MachineId;
    options: { id: MachineId; disabled: boolean; done: boolean }[];
    onChange: (m: MachineId) => void;
  };
  onSubmit: (p: Person, minutes: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [p, setP] = useState<Person>(loadProfile);
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = withMachine?.options.find((o) => o.id === withMachine.value);

  return (
    <form
      className="rounded-2xl border border-line p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        saveProfile(p);
        await onSubmit(p, Number(minutes));
        setBusy(false);
      }}
    >
      <p className="text-lg font-semibold">{title}</p>

      {withMachine && (
        <>
          <fieldset className="mt-4">
            <legend className="label">Machine</legend>
            <div className="mt-1 flex gap-2">
              {withMachine.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={o.disabled}
                  aria-pressed={o.id === withMachine.value}
                  onClick={() => withMachine.onChange(o.id)}
                  className="chip"
                >
                  {o.id}
                </button>
              ))}
            </div>
          </fieldset>
          {selected?.done && (
            <p className="mt-2 text-sm text-muted">
              The previous clothes are still inside. Take them out carefully. Their owner will be told.
            </p>
          )}

          <fieldset className="mt-4">
            <legend className="label">Time shown on the machine (minutes)</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={minutes === String(n)}
                  onClick={() => setMinutes(String(n))}
                  className="chip"
                >
                  {n}
                </button>
              ))}
              <input
                aria-label="Custom minutes"
                className="input w-24"
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                required
                placeholder="Other"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </fieldset>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className="label">Your name</span>
          <input
            className="input mt-1 w-full"
            required
            maxLength={40}
            autoComplete="name"
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">Room</span>
          <input
            className="input mt-1 w-full"
            required
            maxLength={12}
            placeholder="503"
            value={p.room}
            onChange={(e) => setP({ ...p, room: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input
            className="input mt-1 w-full"
            required
            type="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            value={p.phone}
            onChange={(e) => setP({ ...p, phone: e.target.value })}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        Only shown to the next person in line, so they can reach you if your clothes are still inside.
      </p>

      <div className="mt-4 flex gap-2">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
