import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderSummary } from "@/components/order-summary";
import { getOrderForAdmin } from "@/lib/admin-orders";
import { formatOrderDateTime } from "@/lib/orders";
import { formatPrice } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Order · Admin",
};

// Read-only view of any order. Payment state changes only through the
// Stripe webhook, so there are no actions here.
export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[reference]">) {
  return (
    <main className="container-prose section flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-caption text-muted">
        <Link href="/admin/orders" className="link-quiet">
          Orders
        </Link>
      </nav>
      <Suspense fallback={<div className="h-96 animate-pulse bg-surface-strong" aria-busy="true" />}>
        <OrderDetail params={params} />
      </Suspense>
    </main>
  );
}

async function OrderDetail({ params }: Pick<PageProps<"/admin/orders/[reference]">, "params">) {
  const { reference } = await params;
  await requireAdmin(`/admin/orders/${encodeURIComponent(reference)}`);
  const order = await getOrderForAdmin(reference);
  if (!order) notFound();

  const address = order.shipping?.address;
  const rows: [string, React.ReactNode][] = [
    ["Customer", `${order.user.name} (${order.user.email})`],
    ["Receipt email", order.email],
    ["Placed", formatOrderDateTime(order.createdAt)],
    ["Paid", order.paidAt ? formatOrderDateTime(order.paidAt) : "—"],
    ["Hold expires", order.status === "pending" && order.expiresAt ? formatOrderDateTime(order.expiresAt) : "—"],
    ["Checkout session", order.stripeCheckoutSessionId ?? "—"],
    ["Payment intent", order.stripePaymentIntentId ?? "—"],
  ];

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="heading-lg">Order {order.reference}</h1>
        <OrderStatusBadge status={order.status} />
      </header>

      {order.reviewReason && (
        <div role="alert" className="flex flex-col gap-1 border border-sale p-4">
          <p className="font-medium text-sale">Needs review</p>
          <p className="text-caption">{order.reviewReason}</p>
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-caption">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="min-w-0 break-all">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="items-heading" className="flex flex-col gap-4">
        <h2 id="items-heading" className="heading">
          Items
        </h2>
        <ul className="flex flex-col border-t">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 border-b py-3">
              <span className="flex min-w-0 flex-col gap-1">
                <Link href={`/admin/products/${item.productSlug}`} className="link-quiet font-medium">
                  {item.name}
                </Link>
                <span className="text-caption text-muted">
                  {formatPrice(item.unitPrice / 100)} × {item.quantity}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPrice((item.unitPrice * item.quantity) / 100)}
              </span>
            </li>
          ))}
        </ul>
        <OrderSummary lines={[]} subtotal={order.total / 100} />
      </section>

      {address && (
        <section aria-labelledby="delivery-heading" className="border-t pt-6">
          <h2 id="delivery-heading" className="label mb-2">
            Delivery address
          </h2>
          <address className="text-muted not-italic">
            {[
              order.shipping?.name,
              order.shipping?.phone,
              address.line1,
              address.line2,
              address.city,
              address.state,
              address.postalCode,
              address.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </address>
        </section>
      )}
    </>
  );
}
