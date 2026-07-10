import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.plan.findMany();
  plans.forEach((p) => console.log(p.name, "| features:", p.features));
}

main().finally(() => prisma.$disconnect());