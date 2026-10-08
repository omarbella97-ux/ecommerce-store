"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { clearCartAfterPurchase } from "@/app/checkout/actions";

// Polling schedule while the webhook hasn't confirmed payment: quick at
// first (it usually takes a few seconds), then backing off. ~2 minutes total.
const DELAYS_MS = [1500, 1500, 2000, 2000, 3000, 3000, 5000, 5000, 10000, 10000, 15000, 15000, 30000];
const SLOW_AFTER = 5; // attempts before saying it's taking a while

// While the order is pending, ask the status endpoint on a schedule and
// re-render the page once — when the status changes. If confirmation still
// hasn't arrived after the schedule, stop and let the shopper check again.
export function RefreshWhilePending({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [checking, startChecking] = useTransition();
  const stalled = attempt >= DELAYS_MS.length;

  useEffect(() => {
    if (stalled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (await hasLeftPending(sessionId)) {
        if (!cancelled) router.refresh();
        return;
      }
      if (!cancelled) setAttempt((n) => n + 1);
    }, DELAYS_MS[attempt]);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt, stalled, sessionId, router]);

  if (stalled) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-caption text-muted">
          This is taking longer than usual. If you completed payment, it&apos;s
          safe — your order will update as soon as Stripe confirms it. Please
          don&apos;t pay again.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={checking}
          onClick={() =>
            startChecking(async () => {
              if (await hasLeftPending(sessionId)) router.refresh();
              else setAttempt(0);
            })
          }
        >
          {checking ? "Checking…" : "Check again"}
        </button>
      </div>
    );
  }

  return attempt >= SLOW_AFTER ? (
    <p className="text-caption text-muted">Still confirming — this can take up to a minute.</p>
  ) : null;
}

/** Whether the order is no longer pending (paid, or not completed). */
async function hasLeftPending(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return false;
    const { status } = (await res.json()) as { status: string | null };
    return status !== null && status !== "pending";
  } catch {
    return false; // offline or server hiccup: keep waiting
  }
}

// Once the order is confirmed paid, take the purchased items out of the bag
// — once per order in this browser (the server also checks ownership, paid
// status and recency, and only removes the bought quantities).
export function ClearCartOnPaid({
  sessionId,
  reference,
}: {
  sessionId: string;
  reference: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const key = `cart-cleared:${reference}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage unavailable: the server-side checks still apply.
    }
    clearCartAfterPurchase(sessionId).then(() => router.refresh());
  }, [sessionId, reference, router]);
  return null;
}
