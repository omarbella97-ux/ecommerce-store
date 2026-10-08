import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderProgress } from "@/components/order-progress";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderSummary } from "@/components/order-summary";
import {
  formatOrderDateTime,
  getMyOrder,
  getResumableCheckout,
} from "@/lib/orders";
import { formatPrice } from "@/lib/products";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false },
};

// One of the signed-in customer's orders. `params` and the session are read
// inside Suspense. getMyOrder takes the customer from the session and scopes
// the query to them, so another customer's reference is a 404 (as is a
// malformed one, or an order that isn't in their history).
export default function OrderDetailPage({
  params,
}: PageProps<"/account/orders/[reference]">) {
  return (
    <main className="container-prose section flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-caption text-muted">
        <ol className="flex gap-2">
          <li>
            <Link href="/account" className="link-quiet">
              My account
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink" aria-current="page">
            Order details
          </li>
        </ol>
      </nav>
      <Suspense fallback={<DetailSkeleton />}>
        <OrderDetail params={params} />
      </Suspense>
    </main>
  );
}

async function OrderDetail({
  params,
}: Pick<PageProps<"/account/orders/[reference]">, "params">) {
  const { reference } = await params;
  const order = await getMyOrder(reference);
  if (!order) notFound();
  // Already resolved by getMyOrder (cached per request); needed for the
  // resume-payment lookup below.
  const user = await requireUser(`/account/orders/${encodeURIComponent(reference)}`);
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

  // A pending order whose Stripe page is still open can be paid from here.
  const resumable =
    order.status === "pending" ? await getResumableCheckout(user.id) : null;
  const canResume = resumable?.reference === order.reference;
  const address = order.shipping?.address;

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="heading-lg">Order {order.reference}</h1>
        <OrderStatusBadge status={order.status} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-caption">
          <dt className="text-muted">Placed</dt>
          <dd>{formatOrderDateTime(order.createdAt)}</dd>
          {order.paidAt && (
            <>
              <dt className="text-muted">Paid</dt>
              <dd>{formatOrderDateTime(order.paidAt)}</dd>
            </>
          )}
        </dl>
      </header>

      {order.status === "paid" && <OrderProgress current={2} />}

      {order.status === "pending" && (
        <div className="flex flex-col gap-3 border border-ink p-4" role="status">
          <p className="font-medium">Awaiting payment</p>
          <p className="text-caption text-muted">
            {canResume
              ? `Your items are held until ${formatOrderDateTime(resumable.expiresAt)}. Nothing has been charged yet.`
              : "We're waiting for Stripe to confirm this payment. If you paid, it will show as paid shortly — please don't pay again."}
          </p>
          {canResume && (
            <a href={resumable.url} className="btn btn-primary btn-sm self-start">
              Complete payment
            </a>
          )}
        </div>
      )}

      {order.status === "failed" && (
        <div className="flex flex-col gap-3 border border-sale p-4">
          <p className="font-medium text-sale">Payment failed</p>
          <p className="text-caption text-muted">
            The payment was declined, so nothing was charged and the items were
            released.
          </p>
          <Link href="/cart" className="link-cta self-start">
            Go to your bag
          </Link>
        </div>
      )}

      <section aria-labelledby="items-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="items-heading" className="heading">
            Items
          </h2>
          <p className="text-caption text-muted">
            {units} {units === 1 ? "item" : "items"} · prices at time of purchase
          </p>
        </div>
        <ul className="flex flex-col border-t">
          {order.items.map((item) => (
            <OrderItem key={item.id} item={item} />
          ))}
        </ul>
        <div className="bg-surface px-6 pt-4">
          <OrderSummary
            lines={[]}
            subtotal={order.total / 100}
            totalLabel={order.status === "paid" ? "Total paid" : "Total"}
          />
        </div>
      </section>

      {address && (
        <section aria-labelledby="delivery-heading" className="border-t pt-6">
          <h2 id="delivery-heading" className="label mb-2">
            Delivery address
          </h2>
          <address className="text-muted not-italic">
            {[order.shipping?.name, address.line1, address.line2, address.city, address.country]
              .filter(Boolean)
              .join(", ")}
          </address>
        </section>
      )}

      <Link href="/account" className="link-cta self-start">
        Back to order history
      </Link>
    </>
  );
}

type Item = NonNullable<Awaited<ReturnType<typeof getMyOrder>>>["items"][number];

// One order line: picture and link from the current catalogue; name, unit
// price and quantity from the order's snapshot (what was actually bought).
function OrderItem({ item }: { item: Item }) {
  const [image] = item.product.images;
  const href = `/products/${item.product.slug}`;
  return (
    <li className="flex gap-4 border-b py-4">
      <Link
        href={href}
        className="relative aspect-square w-20 shrink-0 bg-surface md:w-24"
        tabIndex={-1}
        aria-hidden="true"
      >
        {image && (
          <Image
            src={image.src}
            alt=""
            fill
            sizes="(min-width: 48rem) 6rem, 5rem"
            className={item.product.imageFit === "cover" ? "object-cover" : "object-contain"}
          />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={href} className="link-quiet font-medium">
            {item.name}
          </Link>
          <p className="text-caption text-muted">
            {item.product.colour} · {formatPrice(item.unitPrice / 100)} each
          </p>
          <p className="text-caption">Quantity {item.quantity}</p>
        </div>
        <p className="font-medium tabular-nums sm:text-right">
          {formatPrice((item.unitPrice * item.quantity) / 100)}
        </p>
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true">
      <span className="sr-only">Loading order</span>
      <div className="flex flex-col gap-3" aria-hidden="true">
        <div className="h-7 w-56 bg-surface-strong" />
        <div className="h-4 w-24 bg-surface-strong" />
        <div className="h-4 w-48 bg-surface-strong" />
      </div>
      <div className="h-56 bg-surface-strong" aria-hidden="true" />
    </div>
  );
}
