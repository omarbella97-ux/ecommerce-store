const STEPS = ["Payment submitted", "Payment confirmed", "Preparing your order"];

// Three-step progress for the order confirmation page. `current` is the
// step in progress: 1 while Stripe confirms payment, 2 once it's paid.
// Dots are the only round shapes (as the design system allows).
export function OrderProgress({ current }: { current: 1 | 2 }) {
  return (
    <ol aria-label="Order progress" className="grid w-full grid-cols-3">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className="relative flex flex-col items-center gap-2 text-center"
          >
            {/* Connector to the previous step. */}
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-[5px] right-1/2 left-[-50%] h-px ${i <= current ? "bg-ink" : "bg-line"}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative size-[11px] rounded-full border ${
                state === "done"
                  ? "border-ink bg-ink"
                  : state === "current"
                    ? "border-ink bg-canvas"
                    : "border-line bg-canvas"
              }`}
            >
              {state === "current" && current === 1 && (
                <span className="absolute inset-[2px] animate-pulse rounded-full bg-ink" />
              )}
            </span>
            <span
              className={`text-caption ${state === "upcoming" ? "text-muted" : "text-ink"} ${state === "current" ? "font-medium" : ""}`}
            >
              {label}
              <span className="sr-only">
                {state === "done" ? " (done)" : state === "current" ? " (in progress)" : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
