import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  ADMIN_ORDERS_LIMIT,
  ORDER_STATUSES,
  isOrderStatus,
  listOrdersForAdmin,
} from "@/lib/admin-orders";
import { formatOrderDate } from "@/lib/orders";
import { formatPrice } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Orders · Admin",
};

const FILTER_LABELS: Record<(typeof ORDER_STATUSES)[number], string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  canceled: "Canceled",
};

// All customers' orders, read-only. requireAdmin() runs before the query
// (and listOrdersForAdmin checks again).
export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <main>
      <div className="container-bleed section-tight">
        <h1 className="heading-lg">Orders</h1>
      </div>
      <Suspense fallback={<div className="toolbar border-t animate-pulse" aria-busy="true" />}>
        <OrderTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OrderTable({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  await requireAdmin("/admin/orders");
  const raw = (await searchParams).status;
  const status = isOrderStatus(raw) ? raw : undefined;
  const orders = await listOrdersForAdmin({ status });

  const filters = [
    { href: "/admin/orders", label: "All", active: !status },
    ...ORDER_STATUSES.map((s) => ({
      href: `/admin/orders?status=${s}`,
      label: FILTER_LABELS[s],
      active: status === s,
    })),
  ];

  return (
    <>
      <div className="toolbar border-t">
        <nav aria-label="Filter by status" className="scroller-x">
          <ul className="flex gap-4">
            {filters.map((f) => (
              <li key={f.href}>
                <Link
                  href={f.href}
                  aria-current={f.active ? "page" : undefined}
                  className={f.active ? "link font-medium" : "link-quiet text-muted"}
                >
                  {f.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="shrink-0 text-muted">
          {orders.length === ADMIN_ORDERS_LIMIT
            ? `Latest ${ADMIN_ORDERS_LIMIT}`
            : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
        </p>
      </div>
      {orders.length === 0 ? (
        <p className="container-bleed section-tight text-muted">No orders here.</p>
      ) : (
        <div className="container-bleed overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-caption tracking-tight">
            <thead>
              <tr className="border-b">
                <th scope="col" className="label py-3 pr-4">Order</th>
                <th scope="col" className="label py-3 pr-4">Placed</th>
                <th scope="col" className="label py-3 pr-4">Customer</th>
                <th scope="col" className="label py-3 pr-4 text-right">Items</th>
                <th scope="col" className="label py-3 pr-4 text-right">Total</th>
                <th scope="col" className="label py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <tr key={order.reference} className="border-b">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/orders/${order.reference}`} className="link-quiet font-medium">
                        {order.reference}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted">{formatOrderDate(order.createdAt)}</td>
                    <td className="py-3 pr-4">
                      {order.user.name}
                      <span className="block text-muted">{order.email}</span>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{units}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatPrice(order.total / 100)}
                    </td>
                    <td className="py-3">
                      <span className="flex flex-col gap-1">
                        <OrderStatusBadge status={order.status} />
                        {order.reviewReason && (
                          <span className="font-medium text-sale">Needs review</span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
