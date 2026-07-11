"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = {
  id: string;
  name: string;
  priceInCents: number;
};

export default function PlanChangeButtons({
  currentPlanId,
  allPlans,
}: {
  currentPlanId: string;
  allPlans: Plan[];
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const sorted = [...allPlans].sort((a, b) => a.priceInCents - b.priceInCents);
  const currentIndex = sorted.findIndex((p) => p.id === currentPlanId);
  const downgradeTarget = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const upgradeTarget =
    currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  async function changePlan(newPlanId: string, label: string) {
    if (!confirm(`Switch to ${label}? You'll be charged/credited a prorated amount immediately.`)) {
      return;
    }

    setLoading(newPlanId);
    const res = await fetch("/api/subscriptions/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPlanId }),
    });
    setLoading(null);

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Something went wrong changing your plan.");
    }
  }

  return (
    <>
      <button
        onClick={() => upgradeTarget && changePlan(upgradeTarget.id, upgradeTarget.name)}
        disabled={!upgradeTarget || loading !== null}
        className="border rounded-md px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading === upgradeTarget?.id ? "Upgrading..." : "Upgrade"}
      </button>
      <button
        onClick={() => downgradeTarget && changePlan(downgradeTarget.id, downgradeTarget.name)}
        disabled={!downgradeTarget || loading !== null}
        className="border rounded-md px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading === downgradeTarget?.id ? "Downgrading..." : "Downgrade"}
      </button>
    </>
  );
}