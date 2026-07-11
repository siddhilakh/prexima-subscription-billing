import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { sendCancellationEmail } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  // Tell Stripe to cancel at period end, not immediately —
  // matches the mockup's "Access until period end" behavior
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  // Reflect it locally right away too — don't wait for the webhook round-trip
  // to update the UI, since the user is sitting there watching this button
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true, status: "cancelled" },
  });

  await sendCancellationEmail(user.email, subscription.currentPeriodEnd.toDateString());

  return NextResponse.json({ success: true });
}