import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "onboarding@resend.dev"; // Resend's default test sender, works without domain verification

export async function sendSubscriptionConfirmedEmail(to: string, planName: string, renewalDate: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your ${planName} subscription is confirmed`,
    html: `
      <h2>Subscription confirmed</h2>
      <p>You're now on the <strong>${planName}</strong> plan.</p>
      <p>Your subscription will renew on <strong>${renewalDate}</strong>.</p>
    `,
  });
}

export async function sendInvoiceEmail(to: string, amount: string, pdfUrl: string | null) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your invoice for ${amount}`,
    html: `
      <h2>Invoice generated</h2>
      <p>We've processed your payment of <strong>${amount}</strong>.</p>
      ${pdfUrl ? `<p><a href="${pdfUrl}">Download your invoice</a></p>` : ""}
    `,
  });
}

export async function sendPaymentFailedEmail(to: string, retryUrl: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Payment failed — action needed",
    html: `
      <h2>Payment failed</h2>
      <p>We couldn't process your recent payment.</p>
      <p><a href="${retryUrl}">Retry payment</a></p>
    `,
  });
}

export async function sendCancellationEmail(to: string, accessUntilDate: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Subscription cancelled",
    html: `
      <h2>Cancellation confirmed</h2>
      <p>Your subscription has been cancelled.</p>
      <p>You'll retain access until <strong>${accessUntilDate}</strong>.</p>
    `,
  });
}