// Catalogue reads. Pages only use these helpers; the data lives in the
// `products` / `categories` tables (src/db/schema.ts), seeded by `pnpm db:seed`.

import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { categories, type CategoryRow, type ProductRow } from "@/db/schema";

export type Product = {
  slug: string;
  name: string;
  category: { slug: string; name: string };
  /** Whole QAR. */
  price: number;
  /** Units available; drives the stock state. */
  stock: number;
  /** Short corner tag on listing tiles (New, Exclusive, …). */
  tag?: string;
  colour: string;
  material: string;
  styleCode: string;
  description: string;
  details: string[];
  /** First image is the listing/lead image. */
  images: ProductImage[];
  /**
   * "contain" for packshots on a plain background (shown whole on the tile
   * tint); "cover" for photos with their own background, which fill the frame.
   */
  imageFit: "contain" | "cover";
};

export type ProductImage = { src: string; alt: string };

export type StockState = "in" | "low" | "out";

const LOW_STOCK_THRESHOLD = 3;

export function stockState(product: Product): StockState {
  if (product.stock <= 0) return "out";
  if (product.stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in";
}

export function stockLabel(product: Product): string {
  switch (stockState(product)) {
    case "out":
      return "Out of stock";
    case "low":
      return `Low stock — only ${product.stock} left`;
    default:
      return "In stock";
  }
}

const qar = new Intl.NumberFormat("en-QA", {
  style: "currency",
  currency: "QAR",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  return qar.format(amount);
}

// Every catalogue read is tagged so a future admin action or stock change
// can call revalidateTag("products").
const PRODUCTS_TAG = "products";

function toProduct(row: ProductRow & { category: CategoryRow }): Product {
  return {
    slug: row.slug,
    name: row.name,
    category: { slug: row.category.slug, name: row.category.name },
    // Stored in minor units (dirhams).
    price: row.price / 100,
    stock: row.stock,
    tag: row.tag ?? undefined,
    colour: row.colour,
    material: row.material,
    styleCode: row.styleCode,
    description: row.description,
    details: row.details,
    images: row.images,
    imageFit: row.imageFit,
  };
}

export async function getProducts({
  limit,
}: { limit?: number } = {}): Promise<Product[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const rows = await db.query.products.findMany({
    with: { category: true },
    orderBy: (p, { asc }) => asc(p.id),
    limit,
  });
  return rows.map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const row = await db.query.products.findFirst({
    with: { category: true },
    where: (p, { eq }) => eq(p.slug, slug),
  });
  return row && toProduct(row);
}

/** Same category first, then the rest of the catalogue. */
export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  return getRelated(product.slug, product.category.slug, limit);
}

async function getRelated(
  slug: string,
  categorySlug: string,
  limit: number,
): Promise<Product[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const rows = await db.query.products.findMany({
    with: { category: true },
    where: (p, { ne }) => ne(p.slug, slug),
    orderBy: (p, { asc, desc }) => [
      desc(
        sql`${p.categoryId} = (select ${categories.id} from ${categories} where ${categories.slug} = ${categorySlug})`,
      ),
      asc(p.id),
    ],
    limit,
  });
  return rows.map(toProduct);
}
