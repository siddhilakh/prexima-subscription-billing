import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  sendSubscriptionConfirmedEmail,
  sendInvoiceEmail,
  sendPaymentFailedEmail,
  sendCancellationEmail,
} from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const prisma = new PrismaClient();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // --- Idempotency check ---
  try {
    await prisma.webhookEvent.create({
      data: {
        id: event.id,
        eventType: event.type,
        payload: event.data as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  // --- Event is new: safe to process ---
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;
        const stripeSubscriptionId = session.subscription as string;

        if (!userId || !planId || !stripeSubscriptionId) {
          console.error("Missing metadata on checkout session:", session.id);
          break;
        }

        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const currentPeriodEnd = stripeSub.items.data[0].current_period_end;

        await prisma.subscription.upsert({
          where: { stripeSubscriptionId },
          update: {
            status: "active",
            currentPeriodEnd: new Date(currentPeriodEnd * 1000),
          },
          create: {
            userId,
            planId,
            stripeSubscriptionId,
            status: "active",
            currentPeriodEnd: new Date(currentPeriodEnd * 1000),
          },
        });

        const activatedPlan = await prisma.plan.findUnique({ where: { id: planId } });
        const emailUser = await prisma.user.findUnique({ where: { id: userId } });
        if (emailUser && activatedPlan) {
          await sendSubscriptionConfirmedEmail(
            emailUser.email,
            activatedPlan.name,
            new Date(currentPeriodEnd * 1000).toDateString()
          );
        }

        console.log("Subscription activated for user:", userId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoice.parent?.subscription_details?.subscription as
          | string
          | undefined;

        if (!stripeSubscriptionId) break;

        let subscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId },
        });

        // Race condition guard: invoice event arrived before checkout.session.completed
        // finished writing the Subscription row. Reconstruct it here instead of skipping.
        if (!subscription) {
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const priceId = stripeSub.items.data[0].price.id;
          const periodEnd = stripeSub.items.data[0].current_period_end;

          const plan = await prisma.plan.findUnique({ where: { stripePriceId: priceId } });
          const user = await prisma.user.findUnique({
            where: { stripeCustomerId: stripeSub.customer as string },
          });

          if (!plan || !user) {
            console.error("Could not resolve plan/user for subscription:", stripeSubscriptionId);
            break;
          }

          subscription = await prisma.subscription.upsert({
            where: { stripeSubscriptionId },
            update: { status: "active", currentPeriodEnd: new Date(periodEnd * 1000) },
            create: {
              userId: user.id,
              planId: plan.id,
              stripeSubscriptionId,
              status: "active",
              currentPeriodEnd: new Date(periodEnd * 1000),
            },
          });
        }

        await prisma.invoice.upsert({
          where: { stripeInvoiceId: invoice.id },
          update: { status: "paid" },
          create: {
            subscriptionId: subscription.id,
            stripeInvoiceId: invoice.id,
            amountInCents: invoice.amount_paid,
            status: "paid",
            pdfUrl: invoice.invoice_pdf,
          },
        });

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "active" },
        });

        const subForEmail = await prisma.subscription.findUnique({
          where: { id: subscription.id },
          include: { user: true },
        });
        if (subForEmail) {
          await sendInvoiceEmail(
  subForEmail.user.email,
  `$${(invoice.amount_paid / 100).toFixed(2)}`,
  invoice.invoice_pdf ?? null
);
        }

        console.log("Invoice recorded for subscription:", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoice.parent?.subscription_details?.subscription as
          | string
          | undefined;

        if (!stripeSubscriptionId) break;

        const subscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId },
        });

        if (subscription) {
          await prisma.invoice.upsert({
            where: { stripeInvoiceId: invoice.id },
            update: { status: "failed" },
            create: {
              subscriptionId: subscription.id,
              stripeInvoiceId: invoice.id,
              amountInCents: invoice.amount_due,
              status: "failed",
            },
          });
         const failedSub = await prisma.subscription.findUnique({
            where: { id: subscription.id },
            include: { user: true },
          });
          if (failedSub) {
            await sendPaymentFailedEmail(
              failedSub.user.email,
              `${process.env.NEXT_PUBLIC_APP_URL}/pricing`
            );
          }

          console.log("Invoice payment failed for subscription:", subscription.id);
        }
        break;
      }

      case "customer.subscription.updated": {
  const sub = event.data.object as Stripe.Subscription;
  const periodEnd = sub.items.data[0].current_period_end;
  const priceId = sub.items.data[0].price.id;

  const plan = await prisma.plan.findUnique({ where: { stripePriceId: priceId } });

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: sub.status === "active" ? "active" : sub.status,
      currentPeriodEnd: new Date(periodEnd * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      ...(plan ? { planId: plan.id } : {}),
    },
  });

  console.log("Subscription updated:", sub.id);
  break;
}

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "expired" },
        });

        console.log("Subscription expired:", sub.id);
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing webhook event:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}