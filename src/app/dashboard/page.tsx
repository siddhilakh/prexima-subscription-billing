import { getCurrentUser } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import CancelButton from "@/components/CancelButton";
import PlanChangeButtons from "@/components/PlanChangeButtons";

const prisma = new PrismaClient();

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { plan: true, invoices: { orderBy: { createdAt: "desc" } } },
  });
  const allPlans = await prisma.plan.findMany();

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">You don't have an active subscription yet.</p>
          <a href="/pricing" className="text-orange-500 underline">
            View plans
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-semibold">{subscription.plan.name} plan</h1>
            <p className="text-sm text-gray-500">
              Renews on {subscription.currentPeriodEnd.toDateString()}
            </p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full ${
              subscription.status === "active"
                ? "bg-green-100 text-green-700"
                : subscription.status === "cancelled"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {subscription.status}
          </span>
        </div>

        <div className="mt-6 flex gap-3">
          <PlanChangeButtons currentPlanId={subscription.planId} allPlans={allPlans} />
          <CancelButton disabled={subscription.cancelAtPeriodEnd} />
        </div>

        <h2 className="mt-8 mb-3 font-medium">Invoices</h2>
        <div className="divide-y">
          {subscription.invoices.map((inv) => (
            <div key={inv.id} className="flex justify-between py-2 text-sm">
              <span>{inv.createdAt.toDateString()}</span>
              <span>${(inv.amountInCents / 100).toFixed(2)}</span>
              <span className="text-gray-400">{inv.status}</span>
              {inv.pdfUrl && (
                <a href={inv.pdfUrl} target="_blank" className="text-orange-500 underline">
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}