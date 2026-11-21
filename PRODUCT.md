# Product

<!-- impeccable:product-schema 1 -->

Shared studio rules (audiences, positioning, Thai-first, honesty, layout and font preferences) live in `../PRODUCT.md` (`E:\fastwork\PRODUCT.md`). Read it too. This file adds only what is specific to คมกริบ บาร์เบอร์.

## Platform

web

## Users

- **Customers:** Thai people booking a haircut on their phone. They pick a service, a barber and a time slot, then check or cancel the booking at `/my`.
- **Shop owner and staff:** they use `/admin` on desktop to see and manage the day's queue.
- Fastwork buyers are the secondary audience. They try both sides with the public demo password.

## Product Purpose

A booking and queue system for คมกริบ บาร์เบอร์ (komkrip), a **fictional** barbershop. It shows a real full-stack app: live slots, and no double-bookings. Success means a customer books in a few taps and staff trust the queue.

## Operating Context

- Live at https://komkrip.shswsy.workers.dev. Demo data is re-seeded daily at 03:00 Bangkok time.
- Shop time is UTC+7. Opening hours, services and staff come from `shared/shop.ts`.

## Capabilities and Constraints

- React SPA plus a Hono Worker on Cloudflare Workers and D1. Deploy with `npm run deploy` only.
- One atomic insert guards against double-booking. Keep it atomic.
- In demo mode the admin view masks phone numbers.
- Keep the "fictional business" note.
- Portfolio piece #3.
