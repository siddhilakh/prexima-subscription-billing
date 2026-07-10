import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Webhook idempotency", () => {
  const testEventId = "evt_test_idempotency_12345";

  beforeEach(async () => {
    // Clean slate before each test — remove this test event if it exists
    await prisma.webhookEvent.deleteMany({ where: { id: testEventId } });
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { id: testEventId } });
    await prisma.$disconnect();
  });

  it("processes a new webhook event and records it", async () => {
    const event = await prisma.webhookEvent.create({
      data: {
        id: testEventId,
        eventType: "invoice.payment_succeeded",
        payload: { test: true },
      },
    });

    expect(event.id).toBe(testEventId);

    const found = await prisma.webhookEvent.findUnique({ where: { id: testEventId } });
    expect(found).not.toBeNull();
  });

  it("rejects a duplicate webhook event with the same ID", async () => {
    // First insert — should succeed
    await prisma.webhookEvent.create({
      data: {
        id: testEventId,
        eventType: "invoice.payment_succeeded",
        payload: { test: true },
      },
    });

    // Second insert with the SAME event ID — should fail with unique constraint violation
    await expect(
      prisma.webhookEvent.create({
        data: {
          id: testEventId,
          eventType: "invoice.payment_succeeded",
          payload: { test: true },
        },
      })
    ).rejects.toThrow();
  });

  it("confirms only one row exists after duplicate delivery is attempted", async () => {
    await prisma.webhookEvent.create({
      data: { id: testEventId, eventType: "invoice.payment_succeeded", payload: { test: true } },
    });

    try {
      await prisma.webhookEvent.create({
        data: { id: testEventId, eventType: "invoice.payment_succeeded", payload: { test: true } },
      });
    } catch {
      // expected — this is the duplicate being correctly rejected
    }

    const count = await prisma.webhookEvent.count({ where: { id: testEventId } });
    expect(count).toBe(1);
  });
});