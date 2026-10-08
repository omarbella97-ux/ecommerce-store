"use server";

import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { redirect } from "next/navigation";
import { getCart, readCart, writeCart } from "@/lib/cart";
import {
  attachCheckoutSession,
  createPendingOrder,
  getOrderBySessionForUser,
  getPendingOrdersForUser,
  releaseOrder,
  reserveStock,
} from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { CHECKOUT_TTL_SECONDS, CURRENCY, appUrl, stripe } from "@/lib/stripe";

export type CheckoutState = { error?: string };

// Tags Checkout Sessions from this flow in the Stripe Dashboard.
const INTEGRATION_IDENTIFIER = "maison_web_checkout_kqzvhrtm";

/**
 * Starts Stripe Checkout for the signed-in user's bag. Takes no input from
 * the browser beyond the request itself: the bag comes from the cart cookie
 * (slugs and quantities) and every name, price and total from Postgres.
 * Payment is confirmed later by the Stripe webhook, never here.
 */
export async function startCheckout(): Promise<CheckoutState> {
  const user = await requireUser("/cart");

  // 1. One open checkout per customer: close earlier sessions and return
  //    their reserved stock first — otherwise the shopper's own hold would
  //    make their items look sold out in the check below.
  for (const previous of await getPendingOrdersForUser(user.id)) {
    if (previous.stripeCheckoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(previous.stripeCheckoutSessionId);
      // Already paid: the webhook will mark it; leave its stock taken.
      if (session.status === "complete") continue;
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(session.id);
      }
    }
    // Only if its session is still the one seen above, so a session attached
    // meanwhile (another tab) isn't left payable on a released order.
    await releaseOrder(previous.id, "expired", {
      sessionId: previous.stripeCheckoutSessionId,
    });
  }

  // 2. Stock check against live data (friendly): don't start with a bag
  //    that has unavailable or reduced lines.
  const { lines } = await getCart();
  if (lines.length === 0) return { error: "Your bag is empty." };
  if (lines.some((line) => line.issue || !line.product)) {
    return {
      error: "Some items in your bag have changed. Review them, then check out again.",
    };
  }

  // 3. The order, priced from the database.
  const order = await createPendingOrder({
    userId: user.id,
    email: user.email,
    lines: lines.map((line) => ({ product: line.product!, quantity: line.quantity })),
  });

  // 4. Stock check that counts: atomic per-product reservation.
  const reservation = await reserveStock(order);
  if (!reservation.ok) {
    return reservation.soldOut.length > 0
      ? { error: `${reservation.soldOut.join(", ")} just sold out. Your bag shows what's left.` }
      : { error: "We couldn't start checkout. Please try again in a moment." };
  }
  revalidateTag("products", "max");

  // 5. The Stripe Checkout Session, built from the order's own lines.
  const imageBySlug = new Map(
    lines.map((line) => [line.slug, line.product?.images[0]?.src]),
  );
  let checkoutUrl: string;
  let session: Stripe.Checkout.Session | undefined;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: order.items.map((item) => {
          const image = imageBySlug.get(item.productSlug);
          return {
            quantity: item.quantity,
            price_data: {
              currency: CURRENCY,
              unit_amount: item.unitPrice,
              product_data: { name: item.name, ...(image ? { images: [image] } : {}) },
            },
          };
        }),
        customer_email: user.email,
        client_reference_id: order.reference,
        metadata: { order_reference: order.reference },
        payment_intent_data: { metadata: { order_reference: order.reference } },
        shipping_address_collection: { allowed_countries: ["QA"] },
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/cart?checkout=canceled`,
        integration_identifier: INTEGRATION_IDENTIFIER,
      },
      // A retried request for the same order can't open a second session.
      { idempotencyKey: `checkout-${order.reference}` },
    );
    if (!session.url) throw new Error("Checkout Session has no URL");
    if (!(await attachCheckoutSession(order.id, session))) {
      throw new Error("Order was released before its session was attached");
    }
    checkoutUrl = session.url;
  } catch (error) {
    console.error(`checkout: Stripe session for ${order.reference} failed`, error);
    // A session that exists must not stay payable for a released order.
    const created = session;
    if (created) {
      await stripe.checkout.sessions
        .expire(created.id)
        .catch((expireError) => console.error(`checkout: expiring ${created.id} failed`, expireError));
    }
    await releaseOrder(order.id, "canceled");
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }

  redirect(checkoutUrl);
}

/** How long after payment the confirmation page may still tidy the bag. */
const CLEAR_WINDOW_MS = 60 * 60 * 1000;

/**
 * Takes the purchased items out of the bag after payment — only when this
 * Checkout Session's order belongs to the user, Stripe has confirmed it as
 * paid, and it was paid within the last hour. Only the bought quantities are
 * removed, so items added since (or in another tab) stay, and revisiting an
 * old confirmation link later can't empty a new bag.
 */
export async function clearCartAfterPurchase(sessionId: string): Promise<void> {
  const user = await requireUser("/cart");
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) return;
  const order = await getOrderBySessionForUser(sessionId, user.id);
  if (order?.status !== "paid" || !order.paidAt) return;
  if (Date.now() - order.paidAt.getTime() > CLEAR_WINDOW_MS) return;

  const cart = await readCart();
  for (const item of order.items) {
    const left = (cart[item.productSlug] ?? 0) - item.quantity;
    if (left > 0) cart[item.productSlug] = left;
    else delete cart[item.productSlug];
  }
  await writeCart(cart);
}
