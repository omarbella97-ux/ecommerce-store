import { formatPrice } from "@/lib/products";

export type SummaryLine = {
  key: string;
  name: string;
  quantity: number;
  /** Line total in whole QAR. */
  amount: number;
};

// Itemised summary shared by the bag (before payment) and the order
// confirmation (after): one row per line with quantity and line total, then
// subtotal, delivery and total. Amounts are whole QAR from the server.
// Pass no lines to render the totals alone (under a fuller item list).
export function OrderSummary({
  lines,
  subtotal,
  totalLabel = "Total",
}: {
  lines: SummaryLine[];
  subtotal: number;
  totalLabel?: string;
}) {
  return (
    <div className="flex flex-col">
      {lines.length > 0 && (
        <ul className="flex flex-col gap-2 border-b pb-4">
          {lines.map((line) => (
            <li key={line.key} className="flex justify-between gap-4 text-caption">
              <span className="min-w-0">
                {line.name}{" "}
                <span className="whitespace-nowrap text-muted">× {line.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(line.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className={`flex flex-col gap-2 ${lines.length > 0 ? "py-4" : "pb-4"}`}>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Delivery</dt>
          <dd>Complimentary</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-3 text-lead font-medium">
          <dt>{totalLabel}</dt>
          <dd className="tabular-nums" aria-live="polite">
            {formatPrice(subtotal)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
