import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ProductListing,
  ProductListingSkeleton,
} from "@/components/product-listing";
import { getCategories, getCategory, getProducts } from "@/lib/products";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return {};
  return { title: category.name };
}

// As on the product page: `params` is read inside Suspense so navigation can
// show the skeleton; slugs from generateStaticParams are still prerendered.
export default function CategoryPage({
  params,
}: PageProps<"/categories/[slug]">) {
  return (
    <main>
      <Suspense fallback={<ProductListingSkeleton />}>
        <CategoryListing params={params} />
      </Suspense>
    </main>
  );
}

async function CategoryListing({
  params,
}: Pick<PageProps<"/categories/[slug]">, "params">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const products = await getProducts({ category: category.slug });

  return (
    <ProductListing
      title={category.name}
      products={products}
      emptyMessage="Nothing in this category just yet — check back soon."
    />
  );
}
