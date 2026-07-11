# Architecture & Design Decisions

## Overview

This is a subscription billing platform built with Next.js 15, Prisma, PostgreSQL (Neon), and Stripe (test mode). It covers plan selection, checkout, webhook-driven state management, invoicing, subscription lifecycle (active/cancelled/expired), upgrade/downgrade, and email notifications.

## Tech stack and why

| Layer | Choice | Reasoning |
|---|---|---|
| Frontend/Backend | Next.js 15 (App Router) | Server components let the pricing/dashboard pages query the database directly without a separate API layer for reads. |
| Database | PostgreSQL via Neon | Serverless Postgres, zero local setup, matches the recommended stack. |
| ORM | Prisma (`prisma-client-js` generator) | Initially attempted the newer `prisma-client` generator (Prisma 6's rewritten client), but it introduced constructor/API instability and an unfamiliar import path with sparse documentation. Reverted to the classic `prisma-client-js` generator for stability. |
| Payments | Stripe (test mode), Stripe-managed Subscriptions | Chose Stripe's native Subscription object over self-managed recurring billing logic. Trades some flexibility for significantly reduced surface area for billing-cycle bugs — Stripe handles renewal timing, proration, and retry logic on failed payments. |
| Auth | Minimal JWT (httpOnly cookie) + bcrypt | Auth is infrastructure, not a graded feature per the brief. Kept intentionally minimal — signup/login only, no password reset or OAuth — to preserve time for the graded criteria (webhooks, lifecycle, invoicing). |
| Email | Resend | Simple API, reliable delivery for a demo/test environment. |
| Amounts | Integers in cents | Avoids floating-point/decimal precision issues and matches Stripe's own convention — zero conversion needed between our DB and Stripe's webhook payloads. |

## Data model

- **User** — includes `stripeCustomerId`, created lazily on first checkout (not at signup), since a user may browse plans without ever paying.
- **Plan** — mirrors Stripe Products/Prices (`stripePriceId`), seeded via a script rather than hardcoded in the UI, so pricing changes don't require code changes.
- **Subscription** — mirrors Stripe's Subscription object. `status` is treated as a *cache* of Stripe's state, not a locally-computed source of truth — every status change is driven by a webhook event, never by application logic guessing at state.
- **Invoice** — one row per successful/failed payment, linked to `Subscription`.
- **WebhookEvent** — the idempotency ledger. `id` is Stripe's own event ID and is the table's primary key, so a duplicate insert fails at the database level rather than relying on application-level checking logic that could itself have bugs.

## Webhook handling and idempotency

Stripe explicitly guarantees "at least once" delivery, not "exactly once." A webhook consumer that doesn't account for this can double-process a single real-world event — e.g., creating two invoices for one payment, or double-sending a confirmation email.

**Design:** every incoming event is inserted into `WebhookEvent` (keyed on Stripe's event ID) *before* any business logic runs. If the insert fails with Prisma's `P2002` (unique constraint violation), the event has already been processed — the handler returns `200 OK` immediately with no further action. Duplicate delivery is caught at the database constraint level, not via an application-level `if` check that could itself race or have a bug.

This is directly tested in `tests/webhook-idempotency.test.ts`, which proves: a new event is recorded correctly, a duplicate insert of the same event ID is rejected, and exactly one row exists in the table regardless of how many times the same event ID is submitted.

## A real edge case: webhook event ordering

During testing, a genuine race condition surfaced: Stripe does not guarantee that `checkout.session.completed` arrives before `invoice.payment_succeeded`, even though intuitively "checkout completes" should precede "invoice for that checkout succeeds." In testing, `invoice.payment_succeeded` was observed arriving and being processed *before* the local `Subscription` row (normally created by `checkout.session.completed`) existed — meaning the invoice handler couldn't find a subscription to attach to, and silently skipped invoice creation.

**Fix:** the `invoice.payment_succeeded` handler no longer assumes the local `Subscription` row exists. If it's missing, the handler reconstructs it directly from the Stripe API (fetching the subscription, its price, and matching local `Plan`/`User` rows) before proceeding — making the handler order-independent regardless of which event Stripe delivers first. `customer.subscription.updated` and `checkout.session.completed` both still run normally and simply update the same row afterward via `upsert`.

This is treated as defense-in-depth alongside the idempotency table: idempotency prevents duplicate processing of the *same* event; order-independence prevents incorrect behavior from *different* events about the same entity arriving out of sequence.

## Subscription lifecycle

- **Active** — default state after a successful checkout.
- **Cancelled** — triggered by the user clicking "Cancel subscription." Uses Stripe's `cancel_at_period_end: true` rather than immediate cancellation, so the user retains access until their current paid period ends (matches the reference mockup's "Access until period end" behavior). The local DB is updated both immediately (for responsive UI) and again via the `customer.subscription.updated` webhook (source of truth), the same defense-in-depth pattern used elsewhere.
- **Expired** — set via the `customer.subscription.deleted` webhook, which Stripe fires once a cancelled subscription's period actually ends.

## Upgrade / downgrade

Implemented using Stripe's subscription item update with `proration_behavior: "create_prorations"` — the plan change and any prorated charge/credit apply immediately, rather than waiting for the next billing cycle. This matches standard SaaS behavior (e.g., upgrading mid-month) and avoids the added complexity of scheduling deferred plan changes.

Note this requires targeting the specific **subscription item ID**, not just the subscription ID — Stripe subscriptions can technically hold multiple line items, so the API needs to know exactly which item's price to swap.

The `customer.subscription.updated` webhook handler also resolves and updates `planId` locally (matching on the new `stripePriceId`), so the dashboard reflects the correct plan whether the change was initiated by our API call or arrives independently via webhook.

## Email notifications

Four triggers implemented via Resend, following the same pattern as the rest of the webhook logic:

1. **Subscription confirmed** — sent from `checkout.session.completed`, right after the local Subscription row is created.
2. **Invoice generated** — sent from `invoice.payment_succeeded`, includes the payment amount and a link to the Stripe-hosted invoice PDF.
3. **Payment failed** — sent from `invoice.payment_failed`, includes a retry link back to `/pricing`. Implemented identically to the other three triggers, but not verified against a live Stripe event end-to-end — genuine renewal failures require either an actual billing cycle or Stripe's fixture-based `stripe trigger` command, which generates a synthetic event not tied to a real local customer/subscription and so doesn't exercise the full lookup path the same way a real failure would. The underlying webhook architecture (idempotent, order-independent) would handle it identically to the three verified triggers.
4. **Cancellation confirmed** — sent directly from the cancel API route (not the webhook), since that's where the user's identity and intent are directly available at the moment of action, states the exact access-until date.

## Testing

`tests/webhook-idempotency.test.ts` (Vitest) proves the core idempotency guarantee at the database level, independent of the HTTP route layer: a new event is recorded, a duplicate is rejected via unique constraint, and only one row ever exists per event ID.

Manual end-to-end testing was performed for all three checkout outcomes described in the assignment brief:
- **Success** (`4242 4242 4242 4242`) — subscription activated, invoice created, confirmation + invoice emails sent.
- **Failed** (`4000 0000 0000 9995`) — verified no Subscription or Invoice row is created; user remains on the Checkout page and can retry, matching the reference mockup.
- **Pending** — Stripe card payments resolve synchronously (success or decline), so a true "pending" state isn't naturally reachable with a standard card. A genuine pending state would require a delayed payment method or 3D Secure authentication (e.g., Stripe's `4000 0025 0000 3155` test card), which was not implemented given time constraints. Documented here rather than left silently unhandled.


## Known limitations

- No true "pending" checkout outcome was implemented. Stripe card payments resolve synchronously (success or decline); a genuine pending state would require a delayed payment method or 3D Secure authentication (e.g., Stripe's `4000 0025 0000 3155` test card), which wasn't built out given time constraints.
- The `invoice.payment_failed` email path is implemented following the same pattern as the other three triggers, but wasn't verified against a live event — genuine renewal failures require either a real billing cycle or Stripe's synthetic test-event tooling, which doesn't route through a real local subscription the same way.