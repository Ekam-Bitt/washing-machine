# Laundry

A small web app for sharing the two washing machines on the roof of the PG.

- See both machines at a glance: free, running (with a live countdown), or done and waiting for someone to collect the clothes.
- Start a wash by entering the time shown on the machine, or join the queue when both machines are busy.
- Get a push notification when your wash is complete, and when a machine frees up for you.
- When it's your turn and the previous clothes are still inside, you see the owner's name, room and phone number so you can get in touch. Nobody else sees them.
- If finished clothes are still inside 10 minutes later and someone is waiting, the owner gets a reminder. A finished wash nobody marks as collected goes back to Free after 3 hours.
- The person at the front of the queue has a 15 minute hold on a freed machine. If they don't show up and someone else is waiting, the next person goes ahead. Missing two turns takes you off the queue.
- Anyone can mark a machine out of order (with a note) or working again. Nobody gets sent to a broken machine.
- A busy-hours chart shows when washes usually start, to help pick a quiet time. Only the hour is recorded.
- `/admin` (separate admin PIN): see who's using each machine and who's queued, clear a stuck machine, remove someone from the queue, change the building PIN, and sign every device out.

Everyone needs the building PIN (posted next to the machines) once per device.

## How it works

- **Next.js** app on Vercel. All state is a single JSON document in **Upstash Redis**, changed under a short lock (`lib/store.ts`).
- Machine status is worked out from timestamps (`lib/status.ts`). `tick()` notices finished cycles and hands a freed machine to the person at the front of the queue, who gets a 15 minute hold on it.
- **Upstash QStash** calls `/api/jobs/cycle-end` at every timed event (a cycle ending, a reminder falling due, a hold running out), so the pushes go out even if nobody has the page open. `mutate()` works out these wake-ups and schedules each one once. Any page poll does the same work, so nothing breaks if a QStash call is late.
- The page polls every 10s while something is happening and every 30s when both machines are idle, and stops while the tab is hidden, to stay well inside Upstash's free tier.
- **Web Push** (VAPID) for notifications, via `public/sw.js`. On iPhone, add the site to the Home Screen first, since iOS only allows push for installed web apps.
- No accounts: after the PIN check the browser gets a signed device cookie. Name, room and phone are remembered in the browser.

## Environment variables

| Name | What it is |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis. Added by the Vercel Marketplace integration. |
| `QSTASH_TOKEN`, `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Upstash QStash. Added by the integration. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push keys, from `npx web-push generate-vapid-keys`. |
| `VAPID_SUBJECT` | A `mailto:` or `https:` contact for push services. |
| `BUILDING_PIN` | The PIN people enter once per device. A PIN set from `/admin` overrides it. |
| `ADMIN_PIN` | The PIN for `/admin`. |
| `SESSION_SECRET` | A random string used to sign device cookies. |
| `APP_URL` | Optional. Public URL QStash should call. Defaults to the production domain. |

To change the building PIN, use `/admin`. Devices that already entered the old PIN stay signed in. Use **Sign everyone out** there if the old PIN leaked.

## Local development

```sh
npm install
vercel env pull .env.local   # optional: without Redis it uses an in-memory store
npm run dev
```

Without `BUILDING_PIN` and `ADMIN_PIN` set locally, the PINs are `0000` and `000000`.
