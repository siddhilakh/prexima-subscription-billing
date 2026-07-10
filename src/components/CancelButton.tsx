"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelButton({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("Cancel your subscription? You'll keep access until the period ends.")) {
      return;
    }

    setLoading(true);
    const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
    setLoading(false);

    if (res.ok) {
      router.refresh();
    } else {
      alert("Something went wrong cancelling your subscription.");
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={disabled || loading}
      className="border rounded-md px-4 py-2 text-sm text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {disabled ? "Cancelling at period end" : loading ? "Cancelling..." : "Cancel subscription"}
    </button>
  );
}