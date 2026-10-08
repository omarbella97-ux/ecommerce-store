import type { OrderStatus } from "@/db/schema";

const LABELS: Record<OrderStatus, string> = {
  paid: "Paid",
  pending: "Awaiting payment",
  failed: "Payment failed",
  expired: "Expired",
  canceled: "Canceled",
};

// Payment status as a dot + caption (order-status utility in globals.css).
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="order-status" data-state={status}>
      {LABELS[status]}
    </span>
  );
}
