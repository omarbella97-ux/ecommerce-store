import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CartLineControls } from "@/components/cart-line-controls";
import { CheckoutButton } from "@/components/checkout-button";
import { OrderSummary } from "@/components/order-summary";
import { ProductTile } from "@/components/product-tile";
import { MAX_QTY, getCart, type CartLine } from "@/lib/cart";
import { getHeldQuantities, getResumableCheckout } from "@/lib/orders";
import {
  formatPrice,
  getNewArrivals,
  stockLabel,
  stockState,
} from "@/lib/products";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false },
};

// The title is in the static shell; the cart (cookie + live prices and
// stock) is read per request inside Suspense.
export default function CartPage({ searchParams }: PageProps<"/cart">) {
  return (
    <main>
      <div className="container-bleed section-tight text-center">
        <h1 className="heading-lg">Your bag</h1>
      </div>
      <Suspense fallback={<CartSkeleton />}>
        <CartContents searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CartContents({
  searchParams,
}: Pick<PageProps<"/cart">, "searchParams">) {
  const [user, { checkout }] = await Promise.all([getSessionUser(), searchParams]);
  // The shopper's own unfinished checkout holds count as available.
  const held = user ? await getHeldQuantities(user.id) : {};
  const { lines, subtotal } = await getCart({ held });
  const canceled = checkout === "canceled";
  if (lines.length === 0) return <EmptyCart />;
  // Only look up an open Stripe session when the shopper just came back.
  const resumable =
    canceled && user ? await getResumableCheckout(user.id) : null;

  const excluded = lines.filter((line) => line.issue).length;
  // Units in the bag (matches the header count); the summary shows how many
  // of them can be bought now.
  const inBag = lines.reduce((sum, line) => sum + line.quantity, 0);
  // What would be charged: purchasable quantities only.
  const summaryLines = lines
    .filter((line) => line.product && line.purchasableQuantity > 0)
    .map((line) => ({
      key: line.slug,
      name: line.product!.name,
      quantity: line.purchasableQuantity,
      amount: line.lineTotal,
    }));

  return (
    <div className="container-page grid gap-10 pb-16 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-12">
      <div>
        {canceled && <CanceledNotice resumable={resumable} />}
        <div className="toolbar border-t px-0">
          <p className="text-muted">
            {inBag} {inBag === 1 ? "item" : "items"} in your bag
          </p>
          <Link href="/new-arrivals" className="link-quiet">
            Continue shopping
          </Link>
        </div>
        <ul aria-label="Items in your bag">
          {lines.map((line) => (
            <CartItem key={line.slug} line={line} />
          ))}
        </ul>
      </div>

      <section
        aria-labelledby="summary-heading"
        className="flex flex-col gap-4 self-start bg-surface p-6 md:sticky md:top-[calc(var(--header-height)+1.5rem)]"
      >
        <h2 id="summary-heading" className="heading">
          Order summary
        </h2>
        {summaryLines.length > 0 ? (
          <OrderSummary lines={summaryLines} subtotal={subtotal} />
        ) : (
          <p className="text-caption text-muted">
            Nothing in your bag can be bought right now.
          </p>
        )}
        {excluded > 0 && (
          <p className="border-l-2 border-sale pl-3 text-caption">
            {excluded === 1
              ? "One item has changed availability."
              : `${excluded} items have changed availability.`}{" "}
            The total only includes what can be bought now.
          </p>
        )}
        <div className="flex flex-col gap-3 border-t pt-4">
          {user ? (
            <>
              <CheckoutButton
                label={resumable ? "Start a new checkout" : "Checkout"}
                blockedReason={
                  excluded > 0
                    ? "Update or remove the highlighted items to continue."
                    : undefined
                }
              />
              <p className="text-caption text-muted">
                Signed in as <span className="text-ink">{user.email}</span>
              </p>
            </>
          ) : (
            <>
              <Link href="/sign-in?next=%2Fcart" className="btn btn-primary btn-block">
                Sign in to check out
              </Link>
              <p className="text-center text-caption text-muted">
                New here?{" "}
                <Link href="/sign-up?next=%2Fcart" className="link text-ink">
                  Create an account
                </Link>{" "}
                — your bag stays as it is.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function CartItem({ line }: { line: CartLine }) {
  const { product } = line;
  const unavailable = line.issue === "unavailable";
  const name = product?.name ?? "Item no longer sold";
  const [image] = product?.images ?? [];

  return (
    <li className="flex gap-4 border-b py-6">
      <div
        className={`relative aspect-square w-24 shrink-0 bg-surface md:w-32 ${unavailable ? "opacity-50 grayscale" : ""}`}
      >
        {image && (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 48rem) 8rem, 6rem"
            className={
              product?.imageFit === "cover" ? "object-cover" : "object-contain"
            }
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className={`flex min-w-0 flex-col gap-1 ${unavailable ? "text-muted" : ""}`}>
            {product ? (
              <Link href={`/products/${product.slug}`} className="link-quiet font-medium">
                {name}
              </Link>
            ) : (
              <p className="font-medium">{name}</p>
            )}
            {product && (
              <p className="text-caption text-muted">
                {product.colour} · {formatPrice(line.unitPrice)} each
              </p>
            )}
          </div>
          <p className="font-medium tabular-nums sm:text-right">
            {unavailable ? (
              <span className="text-muted">Not included</span>
            ) : (
              formatPrice(line.lineTotal)
            )}
          </p>
        </div>

        <StockNotice line={line} />

        <CartLineControls
          slug={line.slug}
          name={name}
          quantity={line.purchasableQuantity}
          maxQuantity={line.maxQuantity}
          needsUpdate={line.issue === "limited"}
          limitNote={limitNote(line)}
        />
      </div>
    </li>
  );
}

// Why + stops at the maximum. Skipped when the low-stock notice already
// gives the number.
function limitNote({ product, maxQuantity }: CartLine): string | undefined {
  if (maxQuantity >= MAX_QTY) return `Limit ${MAX_QTY} per order`;
  if (product && stockState(product) === "low") return undefined;
  return `Only ${maxQuantity} available`;
}

// One availability line per item: gone, reduced, running low, or nothing.
function StockNotice({ line }: { line: CartLine }) {
  const { product } = line;
  if (line.issue === "unavailable") {
    return (
      <p className="stock-status" data-state="out">
        {product ? "Out of stock" : "No longer available"} — remove it to
        continue
      </p>
    );
  }
  if (line.issue === "limited") {
    return (
      <p className="stock-status" data-state="low">
        You added {line.quantity}, but only {line.maxQuantity}{" "}
        {line.maxQuantity === 1 ? "is" : "are"} available
      </p>
    );
  }
  if (product && stockState(product) === "low") {
    return (
      <p className="stock-status" data-state="low">
        {stockLabel(product)}
      </p>
    );
  }
  return null;
}

async function EmptyCart() {
  const suggestions = await getNewArrivals({ limit: 4 });

  return (
    <>
      <div className="container-prose flex flex-col items-center gap-6 pb-16 text-center">
        <p className="display text-display-sm">Your bag is empty.</p>
        <p className="text-muted">
          Items you add will appear here, with prices and availability kept
          up to date.
        </p>
        <Link href="/new-arrivals" className="btn btn-secondary">
          Continue shopping
        </Link>
      </div>
      {suggestions.length > 0 && (
        <section aria-labelledby="suggestions-heading" className="pb-16">
          <h2 id="suggestions-heading" className="heading mb-6 px-gutter text-center">
            New arrivals
          </h2>
          <ul className="grid-products">
            {suggestions.map((product) => (
              <li key={product.slug}>
                <ProductTile product={product} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function CartSkeleton() {
  return (
    <div
      className="container-page grid animate-pulse gap-10 pb-16 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-12"
      aria-busy="true"
    >
      <span className="sr-only">Loading your bag</span>
      <div aria-hidden="true">
        <div className="toolbar border-t px-0">
          <div className="h-4 w-16 bg-surface-strong" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 border-b py-6">
            <div className="aspect-square w-24 bg-surface-strong md:w-32" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-1/2 bg-surface-strong" />
              <div className="h-4 w-1/4 bg-surface-strong" />
              <div className="mt-2 h-10 w-32 bg-surface-strong" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-56 bg-surface-strong" aria-hidden="true" />
    </div>
  );
}

const qatarTime = new Intl.DateTimeFormat("en-QA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Qatar",
});

// Shown after the shopper leaves Stripe Checkout without paying. If their
// session is still open, they can go straight back to it; otherwise the
// hold has ended and checking out again starts fresh.
function CanceledNotice({
  resumable,
}: {
  resumable: Awaited<ReturnType<typeof getResumableCheckout>>;
}) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 border border-ink p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">Payment not completed</p>
        <p className="text-caption text-muted">
          {resumable
            ? `Nothing was charged. Your items are held until ${qatarTime.format(resumable.expiresAt)} — return to payment, or change your bag and check out again.`
            : "Nothing was charged and your items are no longer held. Check out again when you're ready."}
        </p>
      </div>
      {resumable && (
        <a href={resumable.url} className="btn btn-secondary btn-sm shrink-0">
          Return to payment
        </a>
      )}
    </div>
  );
}
