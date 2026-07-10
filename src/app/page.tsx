import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="max-w-5xl mx-auto flex justify-between items-center py-6 px-4">
        <span className="font-semibold text-lg text-gray-900">SubTrack</span>
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="text-gray-600 hover:text-gray-900">
            Log in
          </Link>
          <Link
            href="/pricing"
            className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600"
          >
            Get started
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto text-center pt-24 px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
          Subscription billing, done right.
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Plans, checkout, invoicing, and lifecycle management — built on Stripe,
          with webhook-driven state that's actually reliable.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/pricing"
            className="bg-orange-500 text-white px-6 py-3 rounded-md font-medium hover:bg-orange-600"
          >
            View plans
          </Link>
          <Link
            href="/login"
            className="border px-6 py-3 rounded-md font-medium text-gray-700 hover:bg-gray-100"
          >
            Log in
          </Link>
        </div>
      </main>

      <section className="max-w-4xl mx-auto mt-24 px-4 grid md:grid-cols-3 gap-6 text-sm text-gray-600">
        <div className="bg-white p-5 rounded-lg border">
          <p className="font-medium text-gray-900 mb-1">Real-time billing</p>
          <p>Checkout, invoices, and renewals handled through Stripe.</p>
        </div>
        <div className="bg-white p-5 rounded-lg border">
          <p className="font-medium text-gray-900 mb-1">Reliable webhooks</p>
          <p>Idempotent, order-independent event processing.</p>
        </div>
        <div className="bg-white p-5 rounded-lg border">
          <p className="font-medium text-gray-900 mb-1">Full lifecycle</p>
          <p>Active, cancelled, expired — all reflected accurately.</p>
        </div>
      </section>
    </div>
  );
}