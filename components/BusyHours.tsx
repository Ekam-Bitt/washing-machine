"use client";

import { useState } from "react";

type Filter = "all" | "weekdays" | "weekends";
const FILTERS: { id: Filter; label: string; days: number[] }[] = [
  { id: "all", label: "All days", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "weekdays", label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { id: "weekends", label: "Weekends", days: [0, 6] },
];
/** Below this many logged washes the chart says too little to be useful. */
const MIN_WASHES = 10;
/** Only suggest quiet times people would actually wash at. */
const WAKING = { from: 7, to: 23 };

const hourName = (h: number) => {
  const n = h % 12 || 12;
  return `${n} ${h < 12 || h === 24 ? "AM" : "PM"}`;
};
const span = (from: number, to: number) => `${hourName(from)}–${hourName(to)}`;

/** Bar chart of washes started per hour (India time), to help pick a quiet slot. */
export function BusyHours({ starts, now }: { starts: number[][]; now: { dow: number; hour: number } }) {
  const [filter, setFilter] = useState<Filter>(now.dow === 0 || now.dow === 6 ? "weekends" : "weekdays");
  const [active, setActive] = useState<number | null>(null);

  const days = FILTERS.find((f) => f.id === filter)!.days;
  const byHour = Array.from({ length: 24 }, (_, h) => days.reduce((sum, d) => sum + (starts[d]?.[h] ?? 0), 0));
  const total = byHour.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...byHour);

  let quiet = WAKING.from;
  for (let h = WAKING.from; h < WAKING.to - 1; h++) {
    if (byHour[h] + byHour[h + 1] < byHour[quiet] + byHour[quiet + 1]) quiet = h;
  }
  const busiest = byHour.indexOf(Math.max(...byHour));

  const readout =
    active !== null
      ? `${span(active, active + 1)} · ${byHour[active]} ${byHour[active] === 1 ? "wash" : "washes"} started`
      : `Usually quietest ${span(quiet, quiet + 2)} · busiest ${span(busiest, busiest + 1)}`;

  return (
    <section className="mt-8" aria-labelledby="busy-title">
      <h2 id="busy-title" className="text-sm font-medium uppercase tracking-wide text-muted">
        Busy hours
      </h2>

      <div className="mt-2 flex gap-2" role="group" aria-label="Days">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {total < MIN_WASHES ? (
        <p className="mt-3 text-sm text-muted">
          The chart shows up once {MIN_WASHES} washes have been logged{total ? ` (${total} so far)` : ""}.
        </p>
      ) : (
        <>
          <p className="mt-3 min-h-5 text-sm" aria-live="polite">
            {readout}
          </p>
          <div
            className="mt-2 flex h-28 items-end gap-[2px] border-b border-line/20"
            onMouseLeave={() => setActive(null)}
          >
            {byHour.map((n, h) => (
              <button
                key={h}
                type="button"
                aria-label={`${span(h, h + 1)}: ${n} washes`}
                onMouseEnter={() => setActive(h)}
                onFocus={() => setActive(h)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === h ? null : h)}
                className="flex h-full flex-1 items-end"
              >
                <span
                  className={`block w-full rounded-t-[4px] transition-colors ${
                    h === now.hour && days.includes(now.dow)
                      ? "bg-foreground"
                      : active === h
                        ? "bg-foreground/60"
                        : "bg-foreground/20"
                  }`}
                  style={{ height: n ? `${Math.max(4, (n / max) * 100)}%` : "2px" }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            Washes started at each hour, all time. The dark bar is the current hour.
          </p>
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer">Show as table</summary>
            <table className="mt-2 w-full text-left">
              <thead>
                <tr>
                  <th className="py-1 font-medium">Hour</th>
                  <th className="py-1 text-right font-medium">Washes</th>
                </tr>
              </thead>
              <tbody>
                {byHour.map((n, h) => (
                  <tr key={h} className="border-t border-line/10">
                    <td className="py-1">{span(h, h + 1)}</td>
                    <td className="py-1 text-right font-mono">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
