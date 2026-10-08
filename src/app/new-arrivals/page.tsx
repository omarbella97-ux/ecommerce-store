import type { Metadata } from "next";
import { ProductListing } from "@/components/product-listing";
import { getNewArrivals } from "@/lib/products";

const NEW_ARRIVALS_LIMIT = 24;

export const metadata: Metadata = {
  title: "New arrivals",
  description: "The latest pieces to arrive at the house.",
};

export default async function NewArrivalsPage() {
  const products = await getNewArrivals({ limit: NEW_ARRIVALS_LIMIT });

  return (
    <main>
      <ProductListing
        title="New arrivals"
        description="The latest pieces to arrive at the house."
        products={products}
        emptyMessage="Nothing new just yet — check back soon."
      />
    </main>
  );
}
