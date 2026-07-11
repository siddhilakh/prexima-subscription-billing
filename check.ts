import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.webhookEvent.deleteMany();
  console.log("Cleared Invoice, Subscription, and WebhookEvent tables.");
}

main().finally(() => prisma.$disconnect());