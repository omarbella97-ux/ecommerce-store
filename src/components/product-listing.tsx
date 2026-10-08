import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import type { Product } from "@/lib/products";

// Full-page product listing: breadcrumb and title, a count toolbar, then the
// grid-products row (or an empty state). Used by collection pages and search;
// `children` renders under the title (e.g. the search form).
export function ProductListing({
  title,
  description,
  products,
  emptyMessage,
  children,
}: {
  title: string;
  description?: string;
  products: Product[];
  emptyMessage: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="container-bleed section-tight flex flex-col items-center gap-3 text-center">
        <nav aria-label="Breadcrumb" className="text-caption text-muted">
          <ol className="flex gap-2">
            <li>
              <Link href="/" className="link-quiet">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink" aria-current="page">
              {title}
            </li>
          </ol>
        </nav>
        <h1 className="heading-lg">{title}</h1>
        {description && <p className="text-muted">{description}</p>}
        {children}
      </div>

      <div className="toolbar border-t">
        <p className="text-muted">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </div>

      {products.length > 0 ? (
        <ul className="grid-products">
          {products.map((product) => (
            <li key={product.slug}>
              <ProductTile product={product} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="section container-prose flex flex-col items-center gap-6 text-center">
          <p className="display text-display-sm">{emptyMessage}</p>
          <Link href="/" className="btn btn-secondary">
            Back to home
          </Link>
        </div>
      )}
    </>
  );
}

// Loading frame matching ProductListing (title block, toolbar, tiles) so
// nothing shifts when the products arrive. `children` mirrors the listing's.
export function ProductListingSkeleton({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading products</span>
      <div className="container-bleed section-tight flex flex-col items-center gap-3">
        <div className="h-4 w-32 animate-pulse bg-surface-strong" aria-hidden="true" />
        <div className="h-7 w-48 animate-pulse bg-surface-strong" aria-hidden="true" />
        {children}
      </div>
      <div className="animate-pulse" aria-hidden="true">
        <div className="toolbar border-t">
          <div className="h-4 w-20 bg-surface-strong" />
        </div>
        <ul className="grid-products">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="product-tile">
              <div className="h-4" />
              <div className="media-product bg-surface-strong" />
              <div className="flex flex-col gap-2">
                <div className="h-4 w-2/3 bg-surface-strong" />
                <div className="h-4 w-1/3 bg-surface-strong" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
