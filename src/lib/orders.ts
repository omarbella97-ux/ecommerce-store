// Orders and stock reservation. Every price and total here comes from the
// products table; payment state only moves when Stripe says so (webhook,
// via applyCheckoutSession). All status changes are guarded by the current
// status, so repeated or out-of-order calls are no-ops.

import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { db } from "@/db";
import {
  orderItems,
  orders,
  products,
  stripeEvents,
  type OrderRow,
  type ShippingDetails,
} from "@/db/schema";
import type { Product } from "@/lib/products";
import { requireUser } from "@/lib/session";
import { stripe } from "@/lib/stripe";

const PRODUCTS_TAG = "products";

// Unambiguous characters only (no 0/O, 1/I/L).
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function newReference(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `MSN-${code}`;
}

const toDirhams = (qar: number) => Math.round(qar * 100);

export type OrderLineInput = { product: Product; quantity: number };

/**
 * Creates a pending order and its lines in one transaction (db.batch), with
 * names and unit prices copied from the live product rows passed in.
 */
export async function createPendingOrder({
  userId,
  email,
  lines,
}: {
  userId: string;
  email: string;
  lines: OrderLineInput[];
}): Promise<OrderRow & { items: (typeof orderItems.$inferSelect)[] }> {
  const reference = newReference();
  const items = lines.map(({ product, quantity }) => ({
    // Product ids stay internal (pages work with slugs); resolve in SQL.
    productId: sql<number>`(select ${products.id} from ${products} where ${products.slug} = ${product.slug})`,
    productSlug: product.slug,
    name: product.name,
    unitPrice: toDirhams(product.price),
    quantity,
  }));
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const orderIdByRef = sql<number>`(select ${orders.id} from ${orders} where ${orders.reference} = ${reference})`;

  const [[order], insertedItems] = await db.batch([
    db
      .insert(orders)
      .values({ reference, userId, email, subtotal, total: subtotal })
      .returning(),
    db
      .insert(orderItems)
      .values(items.map((item) => ({ ...item, orderId: orderIdByRef })))
      .returning(),
  ]);
  return { ...order, items: insertedItems };
}

function isStockCheckViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const { code, constraint } = e as { code?: string; constraint?: string };
    if (code === "23514" && constraint === "products_stock_non_negative") return true;
  }
  return false;
}

/**
 * Takes all of the order's quantities out of stock and marks the order
 * reserved, in one statement: either every line is taken or none is
 * (`CHECK (stock >= 0)` aborts the whole statement), so two checkouts can't
 * both take the last unit and there is nothing to roll back. Only a pending,
 * not yet reserved order is reserved. On failure the order is canceled and
 * the names that ran out are returned (empty if the order was no longer
 * pending, e.g. released by a checkout started in another tab).
 */
export async function reserveStock(order: {
  id: number;
  items: { productId: number; name: string }[];
}): Promise<{ ok: true } | { ok: false; soldOut: string[] }> {
  try {
    const result = await db.execute<{ reserved: number }>(sql`
      with o as (
        update orders set reserved_at = now(), updated_at = now()
         where id = ${order.id} and status = 'pending' and reserved_at is null
        returning id
      ), r as (
        update products p
           set stock = p.stock - i.quantity, updated_at = now()
          from order_items i
          join o on i.order_id = o.id
         where p.id = i.product_id
        returning p.id
      )
      select (select count(*) from o)::int as reserved`);
    if (Number(result.rows[0]?.reserved ?? 0) > 0) return { ok: true };
    return { ok: false, soldOut: [] };
  } catch (error) {
    if (!isStockCheckViolation(error)) throw error;
  }

  const short = await db.execute<{ product_id: number }>(sql`
    select i.product_id
      from order_items i
      join products p on p.id = i.product_id
     where i.order_id = ${order.id} and p.stock < i.quantity`);
  const shortIds = new Set(short.rows.map((r) => Number(r.product_id)));
  await releaseOrder(order.id, "canceled");
  return {
    ok: false,
    soldOut: order.items.filter((i) => shortIds.has(i.productId)).map((i) => i.name),
  };
}

/**
 * Moves a pending order to `to` and returns its reserved stock (if it was
 * reserved) — in one statement, and only if this call made the transition.
 * Replays, retries and races therefore can't return stock twice, and an
 * order whose reservation never happened returns nothing. With `sessionId`,
 * it only acts if the order's Checkout Session is still that one (null: still
 * none), so a session attached meanwhile isn't left payable on a released
 * order. Returns whether it acted.
 */
export async function releaseOrder(
  orderId: number,
  to: "expired" | "failed" | "canceled",
  options?: { sessionId: string | null },
): Promise<boolean> {
  const sameSession = options
    ? sql`and stripe_checkout_session_id is not distinct from ${options.sessionId}::text`
    : sql``;
  const result = await db.execute<{ transitioned: number }>(sql`
    with o as (
      update orders set status = ${to}::order_status, updated_at = now()
       where id = ${orderId} and status = 'pending' ${sameSession}
      returning id, reserved_at
    ), r as (
      update products p
         set stock = p.stock + i.quantity, updated_at = now()
        from order_items i
        join o on i.order_id = o.id
       where p.id = i.product_id and o.reserved_at is not null
      returning p.id
    )
    select (select count(*) from o)::int as transitioned, (select count(*) from r)::int as restocked`);
  const acted = Number(result.rows[0]?.transitioned ?? 0) > 0;
  if (acted) revalidateTag(PRODUCTS_TAG, "max");
  return acted;
}

/**
 * Records the order's Checkout Session — only while the order is still
 * pending. Returns false if it was released meanwhile; the caller must then
 * expire the session so it can't be paid.
 */
export async function attachCheckoutSession(
  orderId: number,
  session: Pick<Stripe.Checkout.Session, "id" | "expires_at">,
): Promise<boolean> {
  const [updated] = await db
    .update(orders)
    .set({
      stripeCheckoutSessionId: session.id,
      expiresAt: new Date(session.expires_at * 1000),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return Boolean(updated);
}

export async function getPendingOrdersForUser(userId: string) {
  return db.query.orders.findMany({
    where: and(eq(orders.userId, userId), eq(orders.status, "pending")),
  });
}

/** The order for a Checkout Session, only if it belongs to `userId`. */
export async function getOrderBySessionForUser(sessionId: string, userId: string) {
  return db.query.orders.findFirst({
    where: and(eq(orders.stripeCheckoutSessionId, sessionId), eq(orders.userId, userId)),
    with: { items: { orderBy: (i, { asc }) => asc(i.id) } },
  });
}

export async function userHasPaidOrder(userId: string): Promise<boolean> {
  const row = await db.query.orders.findFirst({
    columns: { id: true },
    where: and(eq(orders.userId, userId), eq(orders.status, "paid")),
  });
  return Boolean(row);
}

function shippingFrom(session: Stripe.Checkout.Session): ShippingDetails | null {
  const details = session.collected_information?.shipping_details;
  if (!details) return null;
  const a = details.address;
  return {
    name: details.name ?? null,
    phone: session.customer_details?.phone ?? null,
    address: {
      line1: a.line1 ?? null,
      line2: a.line2 ?? null,
      city: a.city ?? null,
      state: a.state ?? null,
      postalCode: a.postal_code ?? null,
      country: a.country ?? null,
    },
  };
}

/**
 * Applies a Checkout Session that Stripe sent us (signature-verified webhook)
 * to its order. Never called with data from the browser.
 * - paid (payment_status "paid" / "no_payment_required") → order `paid`
 * - `expired` / `failed` → release the reservation
 * Returns a short description of what happened, for logs.
 */
export async function applyCheckoutSession(
  session: Stripe.Checkout.Session,
  outcome: "paid" | "expired" | "failed",
): Promise<string> {
  const reference = session.metadata?.order_reference ?? session.client_reference_id;
  if (!reference) return "ignored: session has no order reference";

  const order = await db.query.orders.findFirst({ where: eq(orders.reference, reference) });
  if (!order) return `ignored: no order ${reference}`;
  // A reference must come with the session we created for it.
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    return `ignored: ${reference} belongs to another session`;
  }

  if (outcome !== "paid") {
    const acted = await releaseOrder(order.id, outcome);
    return acted ? `${reference} → ${outcome}, stock returned` : `${reference} already ${order.status}`;
  }

  if (session.payment_status === "unpaid") return `${reference}: not paid yet`;
  if (order.status === "paid") return `${reference} already paid`;

  const problems: string[] = [];
  if (session.amount_total !== order.total) {
    problems.push(`Stripe charged ${session.amount_total} but the order total is ${order.total}`);
  }
  if (session.currency !== order.currency) {
    problems.push(`Stripe currency ${session.currency} ≠ order currency ${order.currency}`);
  }
  if (order.status !== "pending") {
    // Money was taken although the reservation had already been released.
    problems.push(`Payment arrived after the order was ${order.status}; stock was not re-reserved`);
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : // Only a zero-total session has no PaymentIntent; fall back to the
        // session id so the "paid has payment" constraint still holds.
        (session.payment_intent?.id ?? session.id);

  const [updated] = await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntent,
      stripeCheckoutSessionId: session.id,
      email: session.customer_details?.email ?? order.email,
      shipping: shippingFrom(session),
      reviewReason: problems.length ? problems.join("; ") : null,
    })
    .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending", "expired", "failed", "canceled"])))
    .returning({ id: orders.id });

  if (!updated) return `${reference} already paid`;
  return problems.length ? `${reference} → paid (needs review)` : `${reference} → paid`;
}

/** Whether a Stripe event id was already handled. */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const row = await db.query.stripeEvents.findFirst({ where: eq(stripeEvents.id, eventId) });
  return Boolean(row);
}

/** Records a handled event (after processing, so failures get retried). */
export async function recordEvent(event: Pick<Stripe.Event, "id" | "type">): Promise<void> {
  await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
}

/**
 * The user's checkout that can still be paid: a pending order whose Stripe
 * session is open and whose reservation hasn't lapsed. Used to offer
 * "Return to payment" after a cancel. One Stripe read per call, so only call
 * it when the shopper has just come back from Checkout.
 */
export async function getResumableCheckout(
  userId: string,
): Promise<{ url: string; expiresAt: Date; reference: string } | null> {
  const [order] = await db.query.orders.findMany({
    where: and(eq(orders.userId, userId), eq(orders.status, "pending")),
    orderBy: (o, { desc }) => desc(o.id),
    limit: 1,
  });
  if (!order?.stripeCheckoutSessionId || !order.expiresAt) return null;
  if (order.expiresAt.getTime() <= Date.now()) return null;

  const session = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
  if (session.status !== "open" || !session.url) return null;
  return { url: session.url, expiresAt: order.expiresAt, reference: order.reference };
}

/** Units the user has reserved in pending checkouts, by product slug. */
export async function getHeldQuantities(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({
      slug: orderItems.productSlug,
      quantity: sql<number>`sum(${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(eq(orders.userId, userId), eq(orders.status, "pending"), isNotNull(orders.reservedAt)),
    )
    .groupBy(orderItems.productSlug);
  return Object.fromEntries(rows.map((r) => [r.slug, Number(r.quantity)]));
}

/**
 * Statuses that appear in a customer's order history: orders that reached
 * payment. Abandoned (`expired`) and never-started (`canceled`) checkouts are
 * left out — each restart creates one, and none of them charged anything.
 */
export const HISTORY_STATUSES = ["paid", "pending", "failed"] as const;

// Customer-facing reads. The exported functions take the customer from the
// session themselves; the queries that accept a user id stay private, so no
// caller can ask for another customer's orders by passing a different id.

export const REFERENCE_PATTERN = new RegExp(`^MSN-[${REF_ALPHABET}]{8}$`);

/** The signed-in customer's order history, newest first. */
export async function getMyOrders() {
  const user = await requireUser("/account");
  return ordersForUser(user.id);
}

/**
 * One of the signed-in customer's orders, or undefined — for someone else's
 * reference, a malformed one, or an order outside the history statuses.
 */
export async function getMyOrder(reference: string) {
  const user = await requireUser(`/account/orders/${encodeURIComponent(reference)}`);
  if (!REFERENCE_PATTERN.test(reference)) return undefined;
  return orderForUser(reference, user.id);
}

async function ordersForUser(userId: string) {
  return db.query.orders.findMany({
    where: and(eq(orders.userId, userId), inArray(orders.status, [...HISTORY_STATUSES])),
    orderBy: (o, { desc }) => [desc(o.createdAt), desc(o.id)],
    with: { items: { columns: { quantity: true, name: true } } },
  });
}

async function orderForUser(reference: string, userId: string) {
  return db.query.orders.findFirst({
    where: and(
      eq(orders.reference, reference),
      eq(orders.userId, userId),
      inArray(orders.status, [...HISTORY_STATUSES]),
    ),
    with: {
      items: {
        orderBy: (i, { asc }) => asc(i.id),
        // Current catalogue data for the picture and link only; the name and
        // price shown come from the order's own snapshot.
        with: {
          product: { columns: { slug: true, colour: true, images: true, imageFit: true } },
        },
      },
    },
  });
}

const orderDate = new Intl.DateTimeFormat("en-QA", {
  dateStyle: "medium",
  timeZone: "Asia/Qatar",
});
const orderDateTime = new Intl.DateTimeFormat("en-QA", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Qatar",
});

/** "8 Oct 2026" (Qatar time) — for lists. */
export const formatOrderDate = (date: Date) => orderDate.format(date);
/** "8 October 2026 at 1:06 pm" (Qatar time) — for detail views. */
export const formatOrderDateTime = (date: Date) => orderDateTime.format(date);
