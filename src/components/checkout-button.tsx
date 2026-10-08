"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { startCheckout, type CheckoutState } from "@/app/checkout/actions";

// Sends nothing but the click: the server builds the order from the bag
// cookie and live product data, reserves the stock, then redirects to Stripe.
// `blockedReason` disables it up front when the bag can't be bought as is.
export function CheckoutButton({
  label = "Checkout",
  blockedReason,
}: {
  label?: string;
  blockedReason?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    startCheckout,
    {},
  );

  // A failed attempt usually means stock moved: re-render the bag so the
  // affected lines show their new state next to the message.
  useEffect(() => {
    if (state.error) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3" aria-busy={pending}>
      {state.error && !pending && (
        <div role="alert" className="border border-sale px-4 py-3 text-caption text-sale">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={pending || Boolean(blockedReason)}
        aria-describedby={blockedReason ? "checkout-blocked" : undefined}
      >
        {pending ? "Reserving your items…" : label}
      </button>
      {blockedReason ? (
        <p id="checkout-blocked" className="text-caption text-muted">
          {blockedReason}
        </p>
      ) : (
        <p role="status" className="text-caption text-muted">
          {pending
            ? "Holding your items and opening secure payment…"
            : "You'll pay on Stripe's secure page. Items are held for 30 minutes."}
        </p>
      )}
    </form>
  );
}
