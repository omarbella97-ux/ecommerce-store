// Catalogue reads. Pages only use these helpers; the data lives in the
// `products` / `categories` tables (src/db/schema.ts), seeded by `pnpm db:seed`.

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  categories,
  products,
  type CategoryRow,
  type ProductRow,
} from "@/db/schema";

export type Category = { slug: string; name: string };

export type Product = {
  slug: string;
  name: string;
  category: Category;
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

// Every catalogue read is tagged so admin actions and stock changes
// can call updateTag / revalidateTag("products").
const PRODUCTS_TAG = "products";

export function toProduct(row: ProductRow & { category: CategoryRow }): Product {
  return {
    slug: row.slug,
    name: row.name,
    category: toCategory(row.category),
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

function toCategory(row: CategoryRow): Category {
  return { slug: row.slug, name: row.name };
}

/** All products, or only those in `category` (a category slug). */
export async function getProducts({
  limit,
  category,
}: { limit?: number; category?: string } = {}): Promise<Product[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const rows = await db.query.products.findMany({
    with: { category: true },
    where: category
      ? (p, { inArray }) =>
          inArray(
            p.categoryId,
            db
              .select({ id: categories.id })
              .from(categories)
              .where(eq(categories.slug, category)),
          )
      : undefined,
    orderBy: (p, { asc }) => asc(p.id),
    limit,
  });
  return rows.map(toProduct);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const rows = await db.query.categories.findMany({
    orderBy: (c, { asc }) => asc(c.id),
  });
  return rows.map(toCategory);
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const row = await db.query.categories.findFirst({
    where: (c, { eq }) => eq(c.slug, slug),
  });
  return row && toCategory(row);
}

/** Most recently added first; id breaks ties between rows seeded together. */
export async function getNewArrivals({
  limit,
}: { limit?: number } = {}): Promise<Product[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const rows = await db.query.products.findMany({
    with: { category: true },
    orderBy: (p, { desc }) => [desc(p.createdAt), desc(p.id)],
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

/**
 * Products by slug with their current price and stock, read straight from
 * the database. Deliberately not "use cache": the cart validates stock and
 * prices against this, so it must not be minutes stale. Call it from Server
 * Actions or request-time components (inside Suspense) only.
 */
export async function getLiveProducts(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const rows = await db.query.products.findMany({
    with: { category: true },
    where: (p, { inArray }) => inArray(p.slug, slugs),
  });
  return rows.map(toProduct);
}

/** Longest query searchProducts looks at; anything past it is ignored. */
export const SEARCH_MAX_LENGTH = 80;

/**
 * Products matching every word of `query` (case-insensitive) in the name,
 * colour, material, style code, description or category name. A blank query
 * returns nothing.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const terms = query
    .slice(0, SEARCH_MAX_LENGTH)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return [];
  return searchByTerms(terms);
}

async function searchByTerms(terms: string[]): Promise<Product[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");

  const matches = terms.map((term) => {
    // Match the term literally: escape LIKE's wildcards and escape char.
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    return or(
      ilike(products.name, pattern),
      ilike(products.colour, pattern),
      ilike(products.material, pattern),
      ilike(products.styleCode, pattern),
      ilike(products.description, pattern),
      inArray(
        products.categoryId,
        db
          .select({ id: categories.id })
          .from(categories)
          .where(ilike(categories.name, pattern)),
      ),
    );
  });

  const rows = await db.query.products.findMany({
    with: { category: true },
    where: and(...matches),
    orderBy: (p, { asc }) => asc(p.id),
  });
  return rows.map(toProduct);
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
