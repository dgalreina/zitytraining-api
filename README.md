# ZityTraining — API

Backend for a gym-management platform — scheduling, client/trainer
management, plans, payments and accounting. This is the API; the
frontend lives in the companion [`zitytraining-web`](../zitytraining-web)
repository.

Built from scratch and in active use by a real gym.

## Tech stack

- [NestJS](https://nestjs.com/) + TypeScript
- MongoDB + [Mongoose](https://mongoosejs.com/)
- JWT auth (access + refresh tokens), role-based guards (admin / trainer)
- [Stripe](https://stripe.com/) (Checkout + Webhooks) for subscriptions
  and session bundles
- Nodemailer for transactional email (password reset)

## Modules

```
auth          Login, refresh tokens, password reset
users         Clients, trainers and admins (one schema, role-gated)
bookings      Calendar sessions, including DST-safe weekly recurrence
plans         The plan catalog (personal/duo/trio pricing tiers)
purchases     Plan assignment, Stripe checkout/webhooks, purchase history
accounting    Monthly billing ledger across all clients
attendance    Staff clock in/out
health-forms  Client health intake forms
progress      Client body-composition tracking
workouts      Exercise library + workout builder
exercises     The exercise catalog used by workouts
holidays      National/regional holidays, used by the calendar
reminders     WhatsApp reminder log (dedup only — sending itself is a
              client-side wa.me link, not an API integration)
mail          Transactional email (SMTP)
```

## Getting started

```bash
npm install
npm run start:dev
```

The API listens on `$PORT` (defaults to `3001`).

### Environment variables

Create a `.env` with:

```
MONGO_URI=mongodb://localhost:27017/zitytraining
JWT_SECRET=
PORT=3001
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Stripe (Checkout + Webhooks)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Transactional email (password reset)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

`STRIPE_SECRET_KEY` is read lazily (not at boot), so the API will still
start without it configured — only the Stripe-dependent endpoints
(checkout/webhook) will fail until it's set.

### Other scripts

```bash
npm run build       # compile to dist/
npm run start:prod  # run a production build
npm run lint         # eslint --fix
```

## Notable design decisions

A few non-obvious things worth knowing before touching the code (see
`CLAUDE.md` for the full list, kept close to the code it describes):

- Recurring weekly sessions are advanced with a timezone-aware helper
  (`bookings/timezone.ts`), not by adding `7 * 24h` in milliseconds —
  the gym is in Madrid, which observes DST, and a flat millisecond
  offset drifts a session's wall-clock time across a DST change.
- Monthly plans are billed in full, never prorated; `finalMonthBilling`
  decides how the last month is billed when a plan pauses or ends
  mid-month.
- "Sesiones libres" (session bundles) aren't stored as a `Plan`
  document — they're derived at request time from the matching
  personal/duo/trio plan, and identified by an `itemId` prefix rather
  than a real database id.
