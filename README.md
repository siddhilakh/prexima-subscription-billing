# Subscription Billing Platform

A full subscription billing platform built for the Prexima Crafts Engineering take-home assignment — covering plans, checkout, webhook-driven state management, invoicing, subscription lifecycle (active/cancelled/expired), upgrade/downgrade, and email notifications.

## Tech stack

- **Frontend/Backend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database:** PostgreSQL (Neon), Prisma ORM
- **Payments:** Stripe (test mode), Stripe-managed Subscriptions
- **Auth:** Minimal JWT-based auth (httpOnly cookie), bcrypt password hashing
- **Email:** Resend

## Setup instructions

### 1. Clone and install

```bash
git clone <your-repo-url>
cd prexima-subscription-billing
npm install
```

### 2. Environment variables

Create a `.env` file in the project root with:
DATABASE_URL="your-neon-postgres-connection-string"
JWT_SECRET="any-long-random-string"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
RESEND_API_KEY="re_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"

### 3. Database setup

```bash
npx prisma migrate dev
npx prisma db seed
```

This creates all tables and seeds three plans (Basic $9/mo, Pro $29/mo, Enterprise $99/mo). You'll need matching Stripe Products/Prices created in your own Stripe test dashboard first — update the `stripePriceId` values in `prisma/seed.ts` to match your own price IDs before seeding.

### 4. Stripe webhook forwarding (local development)

Since Stripe can't reach `localhost` directly, use the Stripe CLI to forward events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` secret it prints into your `.env` as `STRIPE_WEBHOOK_SECRET`.

### 5. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`.

### 6. Run tests

```bash
npm test
```

Runs the webhook idempotency test suite (Vitest).

## Testing payment flows

Use Stripe's test cards:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 9995`

Any future expiry date and any 3-digit CVC.

## Core flows

1. **Sign up / log in** at `/login`
2. **View plans** at `/pricing`, backed by the `Plan` table
3. **Checkout** via Stripe Checkout Sessions (subscription mode)
4. **Webhook** (`/api/webhooks/stripe`) processes events idempotently and updates local state
5. **Dashboard** at `/dashboard` shows current plan, status, invoices, and upgrade/downgrade/cancel controls

See `ARCHITECTURE.md` for design decisions, trade-offs, and known limitations.