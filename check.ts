import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.webhookEvent.findMany({
    orderBy: { processedAt: "desc" },
    take: 5,
  });
  events.forEach((e) => console.log(e.eventType, "|", e.id, "|", e.processedAt));
}

main().finally(() => prisma.$disconnect());