// Loads the placeholder catalogue. Safe to re-run: rows are upserted by slug.
// Run with `pnpm db:seed` (env comes from .env.local via `tsx --env-file`).

import { sql } from "drizzle-orm";
import { db } from "./index";
import { categories, products } from "./schema";
import { seedCategories, seedProducts } from "./seed-data";

const excluded = (column: string) => sql.raw(`excluded.${column}`);

async function main() {
  const categoryRows = await db
    .insert(categories)
    .values(seedCategories)
    .onConflictDoUpdate({
      target: categories.slug,
      set: { name: excluded("name") },
    })
    .returning({ id: categories.id, slug: categories.slug });

  const categoryId = new Map(categoryRows.map((c) => [c.slug, c.id]));

  const productRows = seedProducts.map(({ categorySlug, price, ...product }) => {
    const id = categoryId.get(categorySlug);
    if (id === undefined) throw new Error(`Unknown category "${categorySlug}"`);
    return {
      ...product,
      tag: product.tag ?? null,
      categoryId: id,
      price: price * 100,
    };
  });

  await db
    .insert(products)
    .values(productRows)
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        categoryId: excluded("category_id"),
        name: excluded("name"),
        price: excluded("price"),
        stock: excluded("stock"),
        tag: excluded("tag"),
        colour: excluded("colour"),
        material: excluded("material"),
        styleCode: excluded("style_code"),
        description: excluded("description"),
        details: excluded("details"),
        images: excluded("images"),
        imageFit: excluded("image_fit"),
        updatedAt: sql`now()`,
      },
    });

  console.log(
    `Seeded ${categoryRows.length} categories and ${productRows.length} products.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
