# CLAUDE.md

Portfolio piece #3: booking/queue system for a fictional barbershop (คมกริบ บาร์เบอร์). UI copy is Thai.

## Commands

- `npm run dev` — Vite + `@cloudflare/vite-plugin` (runs the Worker and local D1 together)
- `npm run db:migrate` / `db:migrate:remote` — apply `migrations/` to local / remote D1
- `npm test` — vitest on `shared/*.test.ts` (slot engine)
- `npm run build` — `tsc -b` (app, node, worker projects) + vite build
- `npm run deploy` — build + `wrangler deploy`
- `npm run types` — regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` (file is committed)

## Architecture

- `shared/shop.ts` — single source of truth: shop hours, services, staff, `computeSlots()`. Imported by both UI and Worker.
- `worker/index.ts` — Hono app under `/api`. Booking insert is one `INSERT … SELECT … WHERE NOT EXISTS(overlap)` statement: that is the double-booking guard; keep it atomic.
- `worker/auth.ts` — stateless HMAC cookie session (`ADMIN_PASSWORD`, `SESSION_SECRET` secrets; local values in `.dev.vars`).
- `worker/demo.ts` — demo seed; cron (`0 20 * * *` = 03:00 Bangkok) and `/api/admin/reset-demo` call it when `DEMO=1`.
- `src/` — React SPA, tiny pushState router in `src/router.tsx`; routes `/`, `/my`, `/admin`.
- Dates are `YYYY-MM-DD` strings in shop time (UTC+7); minutes-from-midnight ints for times.

## Notes

- In DEMO mode admin API masks phone numbers (public demo password).
- Visual checks: Claude-in-Chrome screenshots can time out when the Chrome window is occluded; headless Chrome via playwright-core worked reliably.
