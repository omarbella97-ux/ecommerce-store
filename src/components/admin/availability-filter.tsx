import Link from "next/link";
import { stockState, type Product, type StockState } from "@/lib/products";

const AVAILABILITY: { value: StockState; label: string }[] = [
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Sold out" },
];

/** The `?availability=` value if it is a valid state, else undefined (= all). */
export function parseAvailability(value: unknown): StockState | undefined {
  return AVAILABILITY.some((a) => a.value === value) ? (value as StockState) : undefined;
}

// Filter links for an admin product table, with counts from the unfiltered
// list. `basePath` is the page the links point at.
export function AvailabilityFilter({
  basePath,
  products,
  active,
}: {
  basePath: string;
  products: Product[];
  active: StockState | undefined;
}) {
  const filters = [
    { href: basePath, label: "All", count: products.length, active: !active },
    ...AVAILABILITY.map((a) => ({
      href: `${basePath}?availability=${a.value}`,
      label: a.label,
      count: products.filter((p) => stockState(p) === a.value).length,
      active: active === a.value,
    })),
  ];

  return (
    <nav aria-label="Filter by availability" className="scroller-x">
      <ul className="flex gap-4">
        {filters.map((f) => (
          <li key={f.href}>
            <Link
              href={f.href}
              aria-current={f.active ? "page" : undefined}
              className={f.active ? "link font-medium" : "link-quiet text-muted"}
            >
              {f.label} <span className="tabular-nums">({f.count})</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
