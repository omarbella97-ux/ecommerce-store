"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  removeFromCart,
  setCartQuantity,
  type CartActionState,
} from "@/app/cart/actions";

// Controls for one cart line: a −/+ stepper (each button submits the target
// quantity), an "Update to N" fix when stock has dropped below what's in the
// bag, and Remove. Bounds come from live stock on the server, which
// re-checks whatever is sent.
export function CartLineControls({
  slug,
  name,
  quantity,
  maxQuantity,
  limitNote,
  needsUpdate,
}: {
  slug: string;
  name: string;
  /** Quantity to show — already capped to what's purchasable. */
  quantity: number;
  /** 0 when the item can't be bought: only Remove is offered. */
  maxQuantity: number;
  /** Why + is disabled at the maximum, e.g. "Only 2 available". */
  limitNote?: string;
  /** The bag holds more than is available: offer to set it to `quantity`. */
  needsUpdate?: boolean;
}) {
  const [state, formAction, pending] = useActionState<CartActionState, FormData>(
    setCartQuantity,
    {},
  );
  const atMax = quantity >= maxQuantity;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {maxQuantity > 0 && (
          <form action={formAction} aria-busy={pending}>
            <input type="hidden" name="slug" value={slug} />
            <div
              role="group"
              aria-label={`Quantity of ${name}`}
              className="inline-flex h-10 items-stretch border border-ink"
            >
              <StepButton
                quantity={quantity - 1}
                disabled={pending || quantity <= 1}
                label={`Decrease quantity of ${name}`}
              >
                −
              </StepButton>
              <output
                aria-live="polite"
                className={`flex w-10 items-center justify-center border-x border-ink text-body font-medium tabular-nums ${pending ? "text-muted" : ""}`}
              >
                {quantity}
              </output>
              <StepButton
                quantity={quantity + 1}
                disabled={pending || atMax}
                label={`Increase quantity of ${name}`}
              >
                +
              </StepButton>
            </div>
          </form>
        )}

        {needsUpdate && maxQuantity > 0 && (
          <form action={formAction}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              name="quantity"
              value={quantity}
              disabled={pending}
              className="btn btn-secondary btn-sm"
            >
              Update to {quantity}
            </button>
          </form>
        )}

        <form action={removeFromCart}>
          <input type="hidden" name="slug" value={slug} />
          <RemoveButton name={name} />
        </form>

        {pending && (
          <span className="text-caption text-muted" aria-hidden="true">
            Updating…
          </span>
        )}
      </div>

      {atMax && limitNote && maxQuantity > 0 && !needsUpdate && (
        <p className="text-caption text-muted">{limitNote}</p>
      )}
      <p role="alert" className="text-caption text-sale empty:hidden">
        {state.ok === false ? state.message : null}
      </p>
    </div>
  );
}

function StepButton({
  quantity,
  disabled,
  label,
  children,
}: {
  quantity: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  // aria-disabled rather than disabled: a disabled button drops keyboard
  // focus, so pressing + twice (or reaching the limit) would lose the
  // shopper's place. Presses are ignored instead.
  return (
    <button
      type="submit"
      name="quantity"
      value={quantity}
      aria-disabled={disabled}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      aria-label={label}
      className="flex w-10 cursor-pointer items-center justify-center text-lead transition-colors hover:bg-ink hover:text-white aria-disabled:cursor-not-allowed aria-disabled:text-ink/20 aria-disabled:hover:bg-transparent aria-disabled:hover:text-ink/20"
    >
      {children}
    </button>
  );
}

// Reads the pending state of its own <form>, so Remove can show progress
// without an action-state hook (removeFromCart returns nothing).
function RemoveButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Remove ${name} from your bag`}
      className="link text-caption text-muted hover:text-ink disabled:no-underline"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
