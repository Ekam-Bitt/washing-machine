import type { Person } from "@/lib/types";

export function ContactCard({ title, person }: { title: string; person: Person }) {
  return (
    <div className="mt-4 rounded-xl bg-soft px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Name</dt>
        <dd className="font-medium">{person.name}</dd>
        <dt className="text-muted">Room</dt>
        <dd className="font-medium">{person.room}</dd>
        <dt className="text-muted">Phone</dt>
        <dd className="select-all font-mono font-medium">{person.phone}</dd>
      </dl>
    </div>
  );
}
