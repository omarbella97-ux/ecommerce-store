import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/product-form";
import { StockForm } from "@/components/admin/stock-form";
import { getProductForAdmin, listCategoriesForAdmin } from "@/lib/admin-catalogue";
import { stockLabel, stockState } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Edit product · Admin",
};

// requireAdmin() gates the page; updateProduct / updateStock check again on
// submit. `params` and the session are read inside Suspense.
export default function EditProductPage({ params }: PageProps<"/admin/products/[slug]">) {
  return (
    <main className="container-prose section flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-caption text-muted">
        <Link href="/admin/products" className="link-quiet">
          Products
        </Link>
      </nav>
      <Suspense fallback={<div className="h-96 animate-pulse bg-surface-strong" aria-busy="true" />}>
        <EditProduct params={params} />
      </Suspense>
    </main>
  );
}

async function EditProduct({ params }: Pick<PageProps<"/admin/products/[slug]">, "params">) {
  const { slug } = await params;
  await requireAdmin(`/admin/products/${encodeURIComponent(slug)}`);
  const [product, categories] = await Promise.all([
    getProductForAdmin(slug),
    listCategoriesForAdmin(),
  ]);
  if (!product) notFound();

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="heading-lg">{product.name}</h1>
        <p className="text-caption text-muted">
          /{product.slug} ·{" "}
          <Link href={`/products/${product.slug}`} className="link-quiet">
            View in store
          </Link>
        </p>
      </header>

      <section aria-labelledby="stock-heading" className="flex flex-col gap-3 border-y py-6">
        <h2 id="stock-heading" className="heading">
          Stock
        </h2>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
          <span className="stock-status" data-state={stockState(product)}>
            {stockLabel(product)}
          </span>
          <span>
            {product.held} held in unpaid checkouts (returned if they expire)
          </span>
        </p>
        <StockForm slug={product.slug} stock={product.stock} label="Units available" />
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-6">
        <h2 id="details-heading" className="heading">
          Details
        </h2>
        <ProductForm
          mode="edit"
          categories={categories}
          initial={{
            name: product.name,
            slug: product.slug,
            category: product.category.slug,
            // Whole QAR, without trailing ".00".
            price: String(product.price),
            stock: String(product.stock),
            tag: product.tag ?? "",
            colour: product.colour,
            material: product.material,
            styleCode: product.styleCode,
            description: product.description,
            details: product.details.join("\n"),
            images: product.images,
            imageFit: product.imageFit,
          }}
        />
      </section>
    </>
  );
}
