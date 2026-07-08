import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const plans = [
    {
      name: "Basic",
      stripePriceId: "price_1TqWicRc5hHGl9VAuUEqQmAr", 
      priceInCents: 900,
      interval: "month",
      features: { projects: 1, support: "email" },
    },
    {
      name: "Pro",
      stripePriceId: "price_1TqWnqRc5hHGl9VA2ZZKGsvS", 
      priceInCents: 2900,
      interval: "month",
      features: { projects: 10, support: "priority", analytics: true },
    },
    {
      name: "Enterprise",
      stripePriceId: "price_1TqWoWRc5hHGl9VAzb6QDW9X", 
      priceInCents: 9900,
      interval: "month",
      features: { projects: "unlimited", manager: "dedicated", sla: true },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { stripePriceId: plan.stripePriceId },
      update: {},
      create: plan,
    });
  }

  console.log("Plans seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });