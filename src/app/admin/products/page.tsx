import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvailabilityFilter, parseAvailability } from "@/components/admin/availability-filter";
import { StockForm } from "@/components/admin/stock-form";
import { listProductsForAdmin } from "@/lib/admin-catalogue";
import { formatPrice, stockLabel, stockState } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Products · Admin",
};

// Catalogue with live stock, filterable by availability (?availability=).
// requireAdmin() runs before any data is read (signed-in non-admins get a
// 404); the stock form's action checks again.
export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <main>
      <div className="container-bleed section-tight flex flex-wrap items-end justify-between gap-4">
        <h1 className="heading-lg">Products</h1>
        <Link href="/admin/products/new" className="btn btn-primary btn-sm">
          New product
        </Link>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <ProductTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProductTable({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  await requireAdmin("/admin/products");
  const all = await listProductsForAdmin();
  const availability = parseAvailability((await searchParams).availability);
  const products = availability ? all.filter((p) => stockState(p) === availability) : all;

  return (
    <>
      <div className="toolbar border-t">
        <AvailabilityFilter basePath="/admin/products" products={all} active={availability} />
        <p className="hidden shrink-0 text-muted md:block">Held = reserved in unpaid checkouts</p>
      </div>
      {products.length === 0 ? (
        <p className="container-bleed section-tight text-muted">
          No products match.{" "}
          <Link href="/admin/products" className="link text-ink">
            Show all
          </Link>
        </p>
      ) : (
        <div className="container-bleed overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-caption tracking-tight">
            <thead>
              <tr className="border-b">
                <th scope="col" className="label py-3 pr-4">Product</th>
                <th scope="col" className="label py-3 pr-4">Category</th>
                <th scope="col" className="label py-3 pr-4 text-right">Price</th>
                <th scope="col" className="label py-3 pr-4">Status</th>
                <th scope="col" className="label py-3 pr-4 text-right">Held</th>
                <th scope="col" className="label py-3">Stock</th>
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
                  <td className="py-3 pr-4 text-muted">{product.category.name}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatPrice(product.price)}</td>
                  <td className="py-3 pr-4">
                    <span className="stock-status" data-state={stockState(product)}>
                      {stockLabel(product)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{product.held || "—"}</td>
                  <td className="py-3">
                    <StockForm
                      slug={product.slug}
                      stock={product.stock}
                      label={`Stock for ${product.name}`}
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
      <span className="sr-only">Loading products</span>
      <div className="toolbar border-t" aria-hidden="true">
        <div className="h-4 w-20 bg-surface-strong" />
      </div>
      <div className="container-bleed flex flex-col" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 border-b" />
        ))}
      </div>
    </div>
  );
}
