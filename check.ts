import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.subscription.findMany({ orderBy: { createdAt: "desc" } });
  const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" } });
  const webhookEvents = await prisma.webhookEvent.findMany({ orderBy: { processedAt: "desc" } });

  console.log("=== SUBSCRIPTIONS ===");
  subs.forEach((s) => console.log(s.id, "| status:", s.status));

  console.log("\n=== INVOICES ===");
  invoices.forEach((i) => console.log(i.id, "| subscriptionId:", i.subscriptionId));

  console.log("\n=== WEBHOOK EVENTS RECEIVED ===");
  webhookEvents.forEach((w) => console.log(w.eventType, "|", w.id));
}

main().finally(() => prisma.$disconnect());