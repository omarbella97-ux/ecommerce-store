import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvailabilityFilter, parseAvailability } from "@/components/admin/availability-filter";
import { StockForm } from "@/components/admin/stock-form";
import { listProductsForAdmin } from "@/lib/admin-catalogue";
import { stockLabel, stockState, type StockState } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Inventory · Admin",
};

// Sold out first, then low, then in stock.
const URGENCY: Record<StockState, number> = { out: 0, low: 1, in: 2 };

// Live stock for every product, most urgent first, filterable by availability
// (?availability=). requireAdmin() runs before any data is read (signed-in
// non-admins get a 404); the stock form's action checks again.
export default function AdminInventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  return (
    <main>
      <div className="container-bleed section-tight">
        <h1 className="heading-lg">Inventory</h1>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <InventoryTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InventoryTable({ searchParams }: Pick<PageProps<"/admin/inventory">, "searchParams">) {
  await requireAdmin("/admin/inventory");
  const all = await listProductsForAdmin();
  const availability = parseAvailability((await searchParams).availability);
  const products = (availability ? all.filter((p) => stockState(p) === availability) : all).sort(
    (a, b) =>
      URGENCY[stockState(a)] - URGENCY[stockState(b)] ||
      a.stock - b.stock ||
      a.name.localeCompare(b.name),
  );

  return (
    <>
      <div className="toolbar border-t">
        <AvailabilityFilter basePath="/admin/inventory" products={all} active={availability} />
      </div>
      <p className="container-bleed pb-4 text-caption text-muted">
        Available is what customers can buy now. Held units are reserved by unpaid checkouts and
        return to Available if the checkout expires; on hand is both. Setting or adjusting changes
        Available only.
      </p>
      {products.length === 0 ? (
        <p className="container-bleed section-tight text-muted">
          No products match.{" "}
          <Link href="/admin/inventory" className="link text-ink">
            Show all
          </Link>
        </p>
      ) : (
        <div className="container-bleed overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-caption tracking-tight">
            <thead>
              <tr className="border-b">
                <th scope="col" className="label py-3 pr-4">Product</th>
                <th scope="col" className="label py-3 pr-4">Status</th>
                <th scope="col" className="label py-3 pr-4 text-right">Available</th>
                <th scope="col" className="label py-3 pr-4 text-right">Held</th>
                <th scope="col" className="label py-3 pr-4 text-right">On hand</th>
                <th scope="col" className="label py-3">Update</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.slug} className="border-b align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/products/${product.slug}`} className="link-quiet font-medium">
                      {product.name}
                    </Link>
                    <p className="text-muted">
                      {product.styleCode} ·{" "}
                      <Link href={`/products/${product.slug}`} className="link-quiet">
                        View in store
                      </Link>
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="stock-status" data-state={stockState(product)}>
                      {stockLabel(product)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{product.stock}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{product.held || "—"}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {product.stock + product.held}
                  </td>
                  <td className="py-3">
                    <StockForm
                      slug={product.slug}
                      stock={product.stock}
                      label={`Stock for ${product.name}`}
                      adjust
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <span className="sr-only">Loading inventory</span>
      <div className="toolbar border-t" aria-hidden="true">
        <div className="h-4 w-20 bg-surface-strong" />
      </div>
      <div className="container-bleed flex flex-col" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 border-b" />
        ))}
      </div>
    </div>
  );
}
