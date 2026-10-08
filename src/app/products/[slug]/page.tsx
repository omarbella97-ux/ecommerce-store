import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AddToBag } from "@/components/add-to-bag";
import { ProductTile } from "@/components/product-tile";
import {
  formatPrice,
  getProduct,
  getProducts,
  getRelatedProducts,
  stockLabel,
  stockState,
} from "@/lib/products";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return { title: product.name, description: product.description };
}

// The shell renders instantly; reading `params` happens inside Suspense so
// navigation can show the skeleton while the product streams in. Slugs from
// generateStaticParams are still fully prerendered.
export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <main>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ProductDetail({
  params,
}: Pick<PageProps<"/products/[slug]">, "params">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const state = stockState(product);
  const related = await getRelatedProducts(product);
  const { images } = product;

  return (
    <>
      <div className="layout-pdp">
        <div className="gallery" aria-label="Product images">
          {images.map((image, i) => (
            <div
              key={image.src}
              className="media-gallery"
              data-fit={product.imageFit}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                preload={i === 0}
                // Lead image spans the gallery; the rest pair up from xl.
                sizes={
                  i === 0
                    ? "(min-width: 80rem) 67vw, (min-width: 48rem) 58vw, 100vw"
                    : "(min-width: 80rem) 33vw, (min-width: 48rem) 58vw, 100vw"
                }
              />
              {images.length > 1 && (
                <span className="absolute right-gutter bottom-4 bg-canvas/80 px-2 text-caption md:hidden">
                  {i + 1} / {images.length}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="pdp-panel">
          <nav aria-label="Breadcrumb" className="text-caption text-muted">
            <ol className="flex gap-2">
              <li>
                <Link href="/" className="link-quiet">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/categories/${product.category.slug}`}
                  className="link-quiet text-ink"
                >
                  {product.category.name}
                </Link>
              </li>
            </ol>
          </nav>

          <div className="flex flex-col gap-3">
            {product.tag && <p className="label text-muted">{product.tag}</p>}
            <h1 className="heading-lg">{product.name}</h1>
            <p className="text-lead font-medium">
              {formatPrice(product.price)}
            </p>
            <p className="stock-status" data-state={state}>
              {stockLabel(product)}
            </p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-caption">
            <dt className="text-muted">Colour</dt>
            <dd>{product.colour}</dd>
            <dt className="text-muted">Material</dt>
            <dd>{product.material}</dd>
          </dl>

          <div className="flex flex-col gap-3">
            <AddToBag slug={product.slug} soldOut={state === "out"} />
            <p className="text-center text-caption text-muted">
              Complimentary delivery and returns
            </p>
          </div>

          <div>
            <details className="disclosure" open>
              <summary>Description</summary>
              <p>{product.description}</p>
            </details>
            <details className="disclosure">
              <summary>Details</summary>
              <ul className="flex flex-col gap-1">
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </details>
            <details className="disclosure border-b">
              <summary>Delivery and returns</summary>
              <p>
                Complimentary express delivery in 1–3 business days. Returns
                are accepted within 30 days of delivery in original condition.
              </p>
            </details>
          </div>

          <p className="text-caption text-subtle">
            Style code {product.styleCode}
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-12 md:pt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="heading mb-6 px-gutter text-center">
            You may also like
          </h2>
          <ul className="grid-products">
            {related.map((item) => (
              <li key={item.slug}>
                <ProductTile product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// Same frame as the loaded page (gallery well + panel) so nothing shifts
// when the product arrives.
function ProductSkeleton() {
  return (
    <div className="layout-pdp animate-pulse" aria-busy="true">
      <span className="sr-only">Loading product</span>
      <div className="gallery">
        <div className="media-gallery" />
      </div>
      <div className="pdp-panel" aria-hidden="true">
        <div className="h-4 w-32 bg-surface-strong" />
        <div className="flex flex-col gap-3">
          <div className="h-7 w-3/4 bg-surface-strong" />
          <div className="h-5 w-24 bg-surface-strong" />
          <div className="h-4 w-20 bg-surface-strong" />
        </div>
        <div className="h-12 w-full bg-surface-strong" />
      </div>
    </div>
  );
}
