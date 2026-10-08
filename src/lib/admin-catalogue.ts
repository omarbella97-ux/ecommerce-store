// Admin reads and writes for products, stock and categories. Deliberately
// not "use cache": admins must see live stock. Every exported function
// checks the admin role itself (requireAdmin is cached per request, so the
// repeat check in Server Actions is free), so no caller can reach catalogue
// writes or admin data by forgetting the check. Callers revalidate the
// "products" tag after a successful write.

import "server-only";
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, products } from "@/db/schema";
import {
  STOCK_MAX,
  type CategoryFieldErrors,
  type ProductFieldErrors,
  type ProductInput,
} from "@/lib/admin-validation";
import { toProduct, type Category, type Product } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

const toDirhams = (qar: number) => Math.round(qar * 100);

/** Postgres error code and constraint, unwrapping Drizzle's query error. */
function pgError(error: unknown): { code?: string; constraint?: string } {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return { code, constraint: typeof constraint === "string" ? constraint : undefined };
    }
  }
  return {};
}

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

export type WriteResult<E> = { ok: true } | { ok: false; error?: string; fieldErrors?: E };

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type AdminProduct = Product & {
  /** Units reserved by pending checkouts (already taken out of `stock`). */
  held: number;
};

/** Every product with its live stock and held units, in catalogue order. */
export async function listProductsForAdmin(): Promise<AdminProduct[]> {
  await requireAdmin();
  const [rows, heldRows] = await Promise.all([
    db.query.products.findMany({
      with: { category: true },
      orderBy: (p, { asc }) => asc(p.id),
    }),
    db
      .select({
        productId: orderItems.productId,
        held: sql<number>`sum(${orderItems.quantity})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.status, "pending"), isNotNull(orders.reservedAt)))
      .groupBy(orderItems.productId),
  ]);
  const held = new Map(heldRows.map((r) => [r.productId, Number(r.held)]));
  return rows.map((row) => ({ ...toProduct(row), held: held.get(row.id) ?? 0 }));
}

/** One product, read live, or undefined. */
export async function getProductForAdmin(slug: string): Promise<AdminProduct | undefined> {
  await requireAdmin();
  const row = await db.query.products.findFirst({
    with: { category: true },
    where: (p, { eq }) => eq(p.slug, slug),
  });
  if (!row) return undefined;
  const [held] = await db
    .select({ held: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.status, "pending"),
        isNotNull(orders.reservedAt),
        eq(orderItems.productId, row.id),
      ),
    );
  return { ...toProduct(row), held: Number(held?.held ?? 0) };
}

async function categoryIdFor(slug: string): Promise<number | undefined> {
  const row = await db.query.categories.findFirst({
    columns: { id: true },
    where: (c, { eq }) => eq(c.slug, slug),
  });
  return row?.id;
}

function productColumns(input: ProductInput, categoryId: number) {
  return {
    categoryId,
    name: input.name,
    price: toDirhams(input.price),
    tag: input.tag,
    colour: input.colour,
    material: input.material,
    styleCode: input.styleCode,
    description: input.description,
    details: input.details,
    images: input.images,
    imageFit: input.imageFit,
  };
}

function productConflict(error: unknown): WriteResult<ProductFieldErrors> | undefined {
  const { code, constraint } = pgError(error);
  if (code !== UNIQUE_VIOLATION) return;
  if (constraint?.includes("style_code")) {
    return { ok: false, fieldErrors: { styleCode: "Another product already uses this style code." } };
  }
  if (constraint?.includes("slug")) {
    return { ok: false, fieldErrors: { slug: "Another product already uses this slug." } };
  }
  return { ok: false, error: "Another product already uses one of these values." };
}

export async function createProduct(input: ProductInput): Promise<WriteResult<ProductFieldErrors>> {
  await requireAdmin();
  const categoryId = await categoryIdFor(input.categorySlug);
  if (!categoryId) return { ok: false, fieldErrors: { category: "Choose a category." } };
  try {
    await db.insert(products).values({
      ...productColumns(input, categoryId),
      slug: input.slug,
      stock: input.stock,
    });
  } catch (error) {
    const conflict = productConflict(error);
    if (conflict) return conflict;
    throw error;
  }
  return { ok: true };
}

/** Updates everything except the slug (URLs, carts and orders use it) and stock. */
export async function updateProduct(
  slug: string,
  input: ProductInput,
): Promise<WriteResult<ProductFieldErrors>> {
  await requireAdmin();
  const categoryId = await categoryIdFor(input.categorySlug);
  if (!categoryId) return { ok: false, fieldErrors: { category: "Choose a category." } };
  try {
    const [updated] = await db
      .update(products)
      .set(productColumns(input, categoryId))
      .where(eq(products.slug, slug))
      .returning({ id: products.id });
    if (!updated) return { ok: false, error: "This product no longer exists." };
  } catch (error) {
    const conflict = productConflict(error);
    if (conflict) return conflict;
    throw error;
  }
  return { ok: true };
}

export type StockResult =
  | { ok: true; stock: number }
  | { ok: false; reason: "changed"; stock: number }
  | { ok: false; reason: "range"; stock: number }
  | { ok: false; reason: "missing" };

async function currentStock(slug: string): Promise<number | undefined> {
  const row = await db.query.products.findFirst({
    columns: { stock: true },
    where: (p, { eq }) => eq(p.slug, slug),
  });
  return row?.stock;
}

/**
 * Sets stock to `next`, but only if it is still `expected` — checked and
 * written in one statement, so a checkout that reserved units since the
 * admin loaded the page isn't silently overwritten.
 */
export async function setStock(
  slug: string,
  { expected, next }: { expected: number; next: number },
): Promise<StockResult> {
  await requireAdmin();
  const [updated] = await db
    .update(products)
    .set({ stock: next })
    .where(and(eq(products.slug, slug), eq(products.stock, expected)))
    .returning({ stock: products.stock });
  if (updated) return { ok: true, stock: updated.stock };

  const current = await currentStock(slug);
  return current === undefined
    ? { ok: false, reason: "missing" }
    : { ok: false, reason: "changed", stock: current };
}

/**
 * Adds `delta` (negative to remove) to the live stock, but only if the result
 * stays within 0…STOCK_MAX — checked and written in one statement. It doesn't
 * depend on what the page showed, so checkouts reserving units meanwhile
 * can't make it conflict, and neither write overwrites the other.
 */
export async function adjustStock(slug: string, delta: number): Promise<StockResult> {
  await requireAdmin();
  const [updated] = await db
    .update(products)
    .set({ stock: sql`${products.stock} + ${delta}` })
    .where(
      and(
        eq(products.slug, slug),
        sql`${products.stock} + ${delta} between 0 and ${STOCK_MAX}`,
      ),
    )
    .returning({ stock: products.stock });
  if (updated) return { ok: true, stock: updated.stock };

  const current = await currentStock(slug);
  return current === undefined
    ? { ok: false, reason: "missing" }
    : { ok: false, reason: "range", stock: current };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type AdminCategory = Category & { productCount: number };

export async function listCategoriesForAdmin(): Promise<AdminCategory[]> {
  await requireAdmin();
  const rows = await db
    .select({
      slug: categories.slug,
      name: categories.name,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.id));
  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}

export async function createCategory(input: {
  slug: string;
  name: string;
}): Promise<WriteResult<CategoryFieldErrors>> {
  await requireAdmin();
  try {
    await db.insert(categories).values(input);
  } catch (error) {
    if (pgError(error).code === UNIQUE_VIOLATION) {
      return { ok: false, fieldErrors: { slug: "Another category already uses this slug." } };
    }
    throw error;
  }
  return { ok: true };
}

/** Renames a category; its slug (and so its URL) stays the same. */
export async function renameCategory(
  slug: string,
  name: string,
): Promise<WriteResult<CategoryFieldErrors>> {
  await requireAdmin();
  const [updated] = await db
    .update(categories)
    .set({ name })
    .where(eq(categories.slug, slug))
    .returning({ id: categories.id });
  return updated ? { ok: true } : { ok: false, error: "This category no longer exists." };
}

/** Deletes an empty category. One with products is refused (the FK restricts it too). */
export async function deleteCategory(slug: string): Promise<WriteResult<CategoryFieldErrors>> {
  await requireAdmin();
  const [row] = await db
    .select({ id: categories.id, productCount: count(products.id) })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.slug, slug))
    .groupBy(categories.id);
  if (!row) return { ok: false, error: "This category no longer exists." };
  const inUse = (n: number) =>
    `Move its ${n} ${n === 1 ? "product" : "products"} to another category first.`;
  if (Number(row.productCount) > 0) return { ok: false, error: inUse(Number(row.productCount)) };

  try {
    await db.delete(categories).where(eq(categories.id, row.id));
  } catch (error) {
    // A product was added to it since the count above.
    if (pgError(error).code === FOREIGN_KEY_VIOLATION) {
      return { ok: false, error: "Products were just added to this category. Move them first." };
    }
    throw error;
  }
  return { ok: true };
}
