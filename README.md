# Laundry

A small web app for sharing the two washing machines on the roof of the PG.

- See both machines at a glance: free, running (with a live countdown), or done and waiting for someone to collect the clothes.
- Start a wash by entering the time shown on the machine, or join the queue when both machines are busy.
- Get a push notification when your wash is complete, and when a machine frees up for you.
- When it's your turn and the previous clothes are still inside, you see the owner's name, room and phone number so you can get in touch. Nobody else sees them.

Everyone needs the building PIN (posted next to the machines) once per device.

## How it works

- **Next.js** app on Vercel. All state is a single JSON document in **Upstash Redis**, changed under a short lock (`lib/store.ts`).
- Machine status is worked out from timestamps (`lib/status.ts`). `tick()` notices finished cycles and hands a freed machine to the person at the front of the queue, who gets a 15 minute hold on it.
- **Upstash QStash** calls `/api/jobs/cycle-end` when a cycle is due to finish, so the pushes go out even if nobody has the page open. Any page poll does the same work, so nothing breaks if a QStash call is late.
- **Web Push** (VAPID) for notifications, via `public/sw.js`. On iPhone, add the site to the Home Screen first, since iOS only allows push for installed web apps.
- No accounts: after the PIN check the browser gets a signed device cookie. Name, room and phone are remembered in the browser.

## Environment variables

| Name | What it is |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis. Added by the Vercel Marketplace integration. |
| `QSTASH_TOKEN`, `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Upstash QStash. Added by the integration. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push keys, from `npx web-push generate-vapid-keys`. |
| `VAPID_SUBJECT` | A `mailto:` or `https:` contact for push services. |
| `BUILDING_PIN` | The PIN people enter once per device. |
| `SESSION_SECRET` | A random string used to sign device cookies. |
| `APP_URL` | Optional. Public URL QStash should call. Defaults to the production domain. |

To change the PIN:

```sh
vercel env rm BUILDING_PIN production
vercel env add BUILDING_PIN production
vercel --prod
```

Devices that already entered the old PIN stay signed in.

## Local development

```sh
npm install
vercel env pull .env.local   # optional: without Redis it uses an in-memory store
npm run dev
```

Without `BUILDING_PIN` set locally, the PIN is `0000`.
