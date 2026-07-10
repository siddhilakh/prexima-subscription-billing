import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function PricingPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { priceInCents: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <h1 className="text-3xl font-bold">Choose your plan</h1>
        <p className="text-gray-500 mt-2">Simple pricing, cancel anytime.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const features = plan.features as string[];
          const isPro = plan.name === "Pro";

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-6 bg-white ${
                isPro ? "border-orange-400 shadow-lg" : "border-gray-200"
              }`}
            >
              {isPro && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-400 text-white text-xs px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}

              <h2 className="text-lg font-semibold text-gray-900">{plan.name}</h2>
              <p className="text-3xl font-bold mt-2">
                ${(plan.priceInCents / 100).toFixed(0)}
                <span className="text-base font-normal text-gray-500">
                  /{plan.interval}
                </span>
              </p>

              <ul className="mt-4 space-y-2 text-sm text-gray-600">
  {features.map((feature) => (
    <li key={feature} className="flex items-center gap-2">
      <span className="text-orange-500">✓</span>
      {feature}
    </li>
  ))}
</ul>

              <form action="/api/checkout" method="POST" className="mt-6">
                <input type="hidden" name="planId" value={plan.id} />
                <button
                  type="submit"
                  className={`w-full rounded-md py-2 text-sm font-medium border ${
                    isPro
                      ? "bg-orange-400 text-white border-orange-400"
                      : "bg-white text-gray-900 border-gray-300"
                  }`}
                >
                  Select plan
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}