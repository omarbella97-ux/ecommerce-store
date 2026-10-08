import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClearCartOnPaid, RefreshWhilePending } from "@/components/checkout-status";
import { OrderProgress } from "@/components/order-progress";
import { OrderSummary } from "@/components/order-summary";
import type { OrderStatus } from "@/db/schema";
import { getOrderBySessionForUser } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

// Stripe sends the shopper here after Checkout. Reaching this page proves
// nothing: it only shows the order's status, which the verified Stripe
// webhook sets. Only the order's owner can see it.
export default function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  return (
    <main className="container-prose section flex flex-col items-center gap-8">
      <Suspense fallback={<StatusSkeleton />}>
        <OrderStatusView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// What each non-paid state means for the shopper, and what to do next.
const unpaidCopy: Record<
  Exclude<OrderStatus, "paid" | "pending">,
  { title: string; body: string }
> = {
  failed: {
    title: "Payment didn't go through",
    body: "The payment was declined, so nothing was charged and your items are no longer held. Check out again to try another payment method.",
  },
  expired: {
    title: "Checkout expired",
    body: "The payment page closed before payment, so nothing was charged and your items are no longer held. They're still in your bag if you'd like to try again.",
  },
  canceled: {
    title: "Checkout couldn't start",
    body: "Some items sold out before we could hold them, so nothing was charged. Your bag shows what's still available.",
  },
};

const qatarDateTime = new Intl.DateTimeFormat("en-QA", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Qatar",
});

// Kept at the same place in every state so screen readers announce the
// change when the page refreshes from pending to paid (or not completed).
function StatusAnnouncement({ children }: { children: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {children}
    </p>
  );
}

async function OrderStatusView({
  searchParams,
}: Pick<PageProps<"/checkout/success">, "searchParams">) {
  const { session_id: raw } = await searchParams;
  const sessionId = typeof raw === "string" && raw.startsWith("cs_") ? raw : undefined;
  if (!sessionId) notFound();

  const user = await requireUser(`/checkout/success?session_id=${sessionId}`);
  const order = await getOrderBySessionForUser(sessionId, user.id);
  if (!order) notFound();

  const summary = (
    <section aria-labelledby="order-heading" className="w-full bg-surface p-6">
      <h2 id="order-heading" className="heading mb-4">
        Your order
      </h2>
      <OrderSummary
        lines={order.items.map((item) => ({
          key: String(item.id),
          name: item.name,
          quantity: item.quantity,
          amount: (item.unitPrice * item.quantity) / 100,
        }))}
        subtotal={order.total / 100}
        totalLabel={order.status === "paid" ? "Total paid" : "Total"}
      />
    </section>
  );

  if (order.status === "pending") {
    return (
      <>
        <StatusAnnouncement>Waiting for payment confirmation.</StatusAnnouncement>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="label text-muted">Order {order.reference}</p>
          <h1 className="heading-lg">Confirming your payment…</h1>
          <p className="text-muted">
            Stripe is confirming your payment. This usually takes a few
            seconds and this page will update by itself — there&apos;s no need
            to pay again.
          </p>
        </div>
        <OrderProgress current={1} />
        <RefreshWhilePending sessionId={sessionId} />
        {summary}
      </>
    );
  }

  if (order.status !== "paid") {
    const copy = unpaidCopy[order.status];
    return (
      <>
        <StatusAnnouncement>{`${copy.title}. Nothing was charged.`}</StatusAnnouncement>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="label text-muted">
            Order {order.reference} · Nothing was charged
          </p>
          <h1 className="heading-lg">{copy.title}</h1>
          <p className="text-muted">{copy.body}</p>
          <Link href="/cart" className="btn btn-primary mt-3">
            Back to bag
          </Link>
        </div>
        {summary}
      </>
    );
  }

  const address = order.shipping?.address;
  return (
    <>
      <StatusAnnouncement>Payment confirmed. Thank you for your order.</StatusAnnouncement>
      <ClearCartOnPaid sessionId={sessionId} reference={order.reference} />
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="label text-muted">Payment confirmed</p>
        <h1 className="display text-display-sm">Thank you for your order.</h1>
        <p className="text-muted">
          Order {order.reference}
          {order.paidAt && <> · placed {qatarDateTime.format(order.paidAt)}</>}
          <br />
          Placed by <span className="text-ink">{order.email}</span>. Keep your
          order number for any questions about delivery.
        </p>
      </div>

      <OrderProgress current={2} />

      {summary}

      {address && (
        <section aria-labelledby="delivery-heading" className="w-full border-t pt-6">
          <h2 id="delivery-heading" className="label mb-2">
            Delivering to
          </h2>
          <address className="text-muted not-italic">
            {[order.shipping?.name, address.line1, address.line2, address.city, address.country]
              .filter(Boolean)
              .join(", ")}
          </address>
          <p className="mt-2 text-caption text-muted">
            Complimentary express delivery in 1–3 business days.
          </p>
        </section>
      )}

      <div className="flex flex-col items-center gap-4">
        <Link href="/new-arrivals" className="btn btn-primary">
          Continue shopping
        </Link>
        <Link href={`/account/orders/${order.reference}`} className="link-cta">
          View this order in your account
        </Link>
      </div>
    </>
  );
}

function StatusSkeleton() {
  return (
    <div className="flex w-full animate-pulse flex-col items-center gap-8" aria-busy="true">
      <span className="sr-only">Loading your order</span>
      <div className="flex flex-col items-center gap-3" aria-hidden="true">
        <div className="h-4 w-32 bg-surface-strong" />
        <div className="h-7 w-64 bg-surface-strong" />
      </div>
      <div className="h-56 w-full bg-surface-strong" aria-hidden="true" />
    </div>
  );
}
