// Admin order reads: every customer's orders, every status. Read-only —
// payment state still moves only through the Stripe webhook. Each exported
// function checks the admin role itself.

import "server-only";
import { db } from "@/db";
import { orderStatus, type OrderStatus } from "@/db/schema";
import { REFERENCE_PATTERN } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

/** Most orders the list shows; there is no pagination yet. */
export const ADMIN_ORDERS_LIMIT = 100;

export const ORDER_STATUSES = orderStatus.enumValues;

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Newest first, optionally only one status. */
export async function listOrdersForAdmin({ status }: { status?: OrderStatus } = {}) {
  await requireAdmin();
  return db.query.orders.findMany({
    where: status ? (o, { eq }) => eq(o.status, status) : undefined,
    orderBy: (o, { desc }) => [desc(o.createdAt), desc(o.id)],
    limit: ADMIN_ORDERS_LIMIT,
    with: {
      user: { columns: { name: true, email: true } },
      items: { columns: { quantity: true } },
    },
  });
}

/** Any order by reference, or undefined (unknown or malformed reference). */
export async function getOrderForAdmin(reference: string) {
  await requireAdmin();
  if (!REFERENCE_PATTERN.test(reference)) return undefined;
  return db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.reference, reference),
    with: {
      user: { columns: { name: true, email: true } },
      items: { orderBy: (i, { asc }) => asc(i.id) },
    },
  });
}
