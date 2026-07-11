import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { newPlanId } = await req.json();

  if (!newPlanId) {
    return NextResponse.json({ error: "Missing newPlanId" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  const newPlan = await prisma.plan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Fetch the current Stripe subscription to get its item ID —
  // Stripe needs the specific subscription ITEM id (not just the subscription id)
  // to know which line item's price to swap.
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const itemId = stripeSub.items.data[0].id;

  const updatedStripeSub = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: itemId, price: newPlan.stripePriceId }],
    proration_behavior: "create_prorations", // immediate proration, charged/credited right away
  });

  const newPeriodEnd = updatedStripeSub.items.data[0].current_period_end;

  // Update locally right away for a responsive UI; the customer.subscription.updated
  // webhook will also fire and confirm this same state shortly after (defense-in-depth,
  // same pattern used for cancel).
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      planId: newPlan.id,
      currentPeriodEnd: new Date(newPeriodEnd * 1000),
    },
  });

  return NextResponse.json({ success: true });
}