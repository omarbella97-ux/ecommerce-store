"use client";

import { useActionState, useState } from "react";
import { updateStock, type StockFormState } from "@/app/admin/products/actions";
import { STOCK_MAX } from "@/lib/admin-validation";

const inputClass =
  "h-9 w-20 border-b border-ink bg-transparent tabular-nums tracking-tight focus-visible:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-none aria-invalid:border-sale";

// Sets a product's stock and, with `adjust`, adds or removes units.
// Setting sends `expected` — the latest stock this form knows — and the
// server only writes if stock is still that; otherwise it reports the new
// value, which becomes the next `expected` while the typed number is kept.
// Adding and removing apply to live stock, so they don't need `expected`.
export function StockForm({
  slug,
  stock,
  label,
  adjust = false,
}: {
  slug: string;
  stock: number;
  /** Accessible name for the input, e.g. "Stock for Linen Shirt". */
  label: string;
  /** Also show the add / remove units form. */
  adjust?: boolean;
}) {
  const [state, formAction, pending] = useActionState<StockFormState, FormData>(updateStock, {});
  // The latest stock known to this form: the server prop, or an action result
  // when that is newer. Whichever changed last wins, so fresh server data
  // (a refresh, another admin's save) replaces an old result.
  const [seen, setSeen] = useState({ state, stock });
  const [known, setKnown] = useState(stock);
  const [count, setCount] = useState(String(stock));
  const [delta, setDelta] = useState("");
  if (seen.state !== state || seen.stock !== stock) {
    const isNewResult = seen.state !== state;
    const next = isNewResult && state.stock !== undefined ? state.stock : stock;
    setSeen({ state, stock });
    setKnown(next);
    // A failed attempt keeps what the admin typed; the message says why.
    if (!isNewResult || state.ok) setCount(String(next));
    if (isNewResult && state.ok) setDelta("");
  }

  const inputId = `stock-${slug}`;
  const deltaId = `stock-delta-${slug}`;
  const messageId = `${inputId}-message`;
  const failedField = state.ok === false ? (state.field ?? "stock") : undefined;
  const describedBy = state.message ? messageId : undefined;

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="expected" value={known} />
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          id={inputId}
          name="stock"
          type="number"
          inputMode="numeric"
          min={0}
          max={STOCK_MAX}
          step={1}
          required
          value={count}
          onChange={(e) => setCount(e.target.value)}
          disabled={pending}
          aria-invalid={failedField === "stock" ? true : undefined}
          aria-describedby={describedBy}
          className={inputClass}
        />
        <button
          type="submit"
          name="intent"
          value="set"
          className="btn btn-secondary btn-sm"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {/* Sets stock to 0 whatever the number field says. */}
        <button
          type="submit"
          name="intent"
          value="sold-out"
          formNoValidate
          className="btn btn-secondary btn-sm whitespace-nowrap"
          disabled={pending || known === 0}
          aria-label={`Mark sold out: ${label}`}
        >
          Mark sold out
        </button>
      </form>
      {adjust && (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="slug" value={slug} />
          <label htmlFor={deltaId} className="sr-only">
            {`Units to add or remove: ${label}`}
          </label>
          <input
            id={deltaId}
            name="delta"
            type="number"
            inputMode="numeric"
            min={1}
            max={STOCK_MAX}
            step={1}
            required
            placeholder="Units"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            disabled={pending}
            aria-invalid={failedField === "delta" ? true : undefined}
            aria-describedby={describedBy}
            className={inputClass}
          />
          <button
            type="submit"
            name="intent"
            value="add"
            className="btn btn-secondary btn-sm"
            disabled={pending}
            aria-label={`Add units: ${label}`}
          >
            Add
          </button>
          <button
            type="submit"
            name="intent"
            value="remove"
            className="btn btn-secondary btn-sm"
            disabled={pending || known === 0}
            aria-label={`Remove units: ${label}`}
          >
            Remove
          </button>
        </form>
      )}
      <p
        id={messageId}
        role="status"
        className={`max-w-64 text-caption empty:hidden ${state.ok === false ? "text-sale" : "text-muted"}`}
      >
        {state.message ?? ""}
      </p>
    </div>
  );
}
