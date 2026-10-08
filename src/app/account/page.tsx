import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatOrderDate, getMyOrders } from "@/lib/orders";
import { formatPrice } from "@/lib/products";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

// The title is in the static shell; the session is read inside Suspense.
// src/proxy.ts already bounced visitors without a session cookie;
// requireUser is the real check.
export default function AccountPage() {
  return (
    <main className="container-prose section flex flex-col items-center gap-8">
      <h1 className="heading-lg">My account</h1>
      <Suspense fallback={<AccountSkeleton />}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}

async function AccountDetails() {
  const user = await requireUser("/account");
  // Only this customer's orders: getMyOrders reads the user from the session.
  const orders = await getMyOrders();

  return (
    <div className="flex w-full flex-col gap-10">
      <dl className="flex flex-col border-t">
        <Row term="Name" value={user.name} />
        <Row term="Email" value={user.email} />
      </dl>

      <section aria-labelledby="orders-heading" className="flex flex-col gap-4">
        <h2 id="orders-heading" className="heading">
          Order history
        </h2>
        {orders.length === 0 ? (
          <div className="flex flex-col items-start gap-3 border-t pt-4">
            <p className="text-muted">You haven&apos;t placed any orders yet.</p>
            <Link href="/new-arrivals" className="link-cta">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col border-t">
            {orders.map((order) => {
              const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <li key={order.reference} className="border-b">
                  <Link
                    href={`/account/orders/${order.reference}`}
                    className="group flex items-center justify-between gap-4 py-4"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium group-hover:underline">
                        {order.reference}
                      </span>
                      <span className="text-caption text-muted">
                        {formatOrderDate(order.createdAt)} · {units}{" "}
                        {units === 1 ? "item" : "items"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-medium tabular-nums">
                        {formatPrice(order.total / 100)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-muted">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="flex flex-col items-center gap-6">
        {user.role === "admin" && (
          <Link href="/admin" className="link-cta">
            Admin
          </Link>
        )}
        <form action={signOut} className="w-full">
          <button type="submit" className="btn btn-secondary btn-block">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-4">
      <dt className="label">{term}</dt>
      <dd className="min-w-0 truncate text-muted">{value}</dd>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-10" aria-busy="true">
      <span className="sr-only">Loading your account</span>
      <div className="flex flex-col border-t" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="flex justify-between border-b py-4">
            <div className="h-4 w-12 bg-surface-strong" />
            <div className="h-4 w-40 bg-surface-strong" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="h-5 w-32 bg-surface-strong" />
        <div className="flex flex-col border-t">
          {[0, 1].map((i) => (
            <div key={i} className="flex justify-between border-b py-4">
              <div className="flex flex-col gap-2">
                <div className="h-4 w-28 bg-surface-strong" />
                <div className="h-3 w-36 bg-surface-strong" />
              </div>
              <div className="h-4 w-20 bg-surface-strong" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-12 bg-surface-strong" aria-hidden="true" />
    </div>
  );
}
