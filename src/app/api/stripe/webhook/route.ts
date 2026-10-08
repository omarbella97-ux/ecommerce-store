import type Stripe from "stripe";
import { applyCheckoutSession, isEventProcessed, recordEvent } from "@/lib/orders";
import { stripe, stripeWebhookSecret } from "@/lib/stripe";

// Stripe → us. The only place an order becomes paid, expired or failed.
// 1. Verify the signature against the raw body (forged or altered → 400).
// 2. Skip events already handled (Stripe redelivers; ids are recorded).
// 3. Apply the Checkout Session to its order. Transitions are guarded by the
//    order's current status, so concurrent or out-of-order deliveries are
//    harmless.
// 4. Record the event id only after success; errors return 500 so Stripe
//    retries.
export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, stripeWebhookSecret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (await isEventProcessed(event.id)) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    let result = "ignored";
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        // applyCheckoutSession only marks paid when payment_status isn't
        // "unpaid" (delayed methods complete first, pay later).
        result = await applyCheckoutSession(event.data.object, "paid");
        break;
      case "checkout.session.async_payment_failed":
        result = await applyCheckoutSession(event.data.object, "failed");
        break;
      case "checkout.session.expired":
        result = await applyCheckoutSession(event.data.object, "expired");
        break;
    }
    await recordEvent(event);
    console.info(`stripe webhook ${event.id} ${event.type}: ${result}`);
    return Response.json({ received: true });
  } catch (error) {
    console.error(`stripe webhook ${event.id} ${event.type} failed`, error);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
