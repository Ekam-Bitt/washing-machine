"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { WashingMachine } from "./WashingMachine";

export function PinGate({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-xs flex-1 flex-col justify-center px-4 py-12">
      <WashingMachine status="idle" display="" className="mx-auto max-w-[120px]" />
      <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">Laundry</h1>
      <p className="mt-1 text-center text-sm text-muted">Enter the building PIN posted next to the machines.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("POST", "/api/auth", { pin });
            onDone();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <input
          aria-label="Building PIN"
          className="input w-full text-center font-mono text-2xl tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
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
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
