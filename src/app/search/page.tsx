import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ProductListing,
  ProductListingSkeleton,
} from "@/components/product-listing";
import { SearchForm } from "@/components/search-form";
import { getProducts, searchProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the collection by name, colour, material or category.",
};

// `searchParams` is read inside Suspense, so the shell renders instantly and
// the results stream in behind the skeleton.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main>
      <Suspense
        fallback={
          <ProductListingSkeleton>
            <SearchForm />
          </ProductListingSkeleton>
        }
      >
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchResults({
  searchParams,
}: Pick<PageProps<"/search">, "searchParams">) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";

  // No query yet: browse the whole collection under the search field.
  if (!query) {
    return (
      <ProductListing
        title="Search"
        description="Search by name, colour, material or category."
        products={await getProducts()}
        emptyMessage="Nothing in the collection just yet — check back soon."
      >
        <SearchForm />
      </ProductListing>
    );
  }

  const results = await searchProducts(query);

  return (
    <ProductListing
      title="Search"
      description={`Results for “${query}”`}
      products={results}
      emptyMessage={`Nothing matches “${query}”. Try another word.`}
    >
      <SearchForm query={query} />
    </ProductListing>
  );
}
