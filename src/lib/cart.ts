// The shopping cart. It lives in an httpOnly cookie that holds only
// `slug → quantity`; every price, name and stock figure is looked up live
// from the database (getLiveProducts), so nothing the client sends can set a
// price. Pages use getCart / getCartItemCount; writes go through the Server
// Actions in src/app/cart/actions.ts.

import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getLiveProducts, type Product } from "@/lib/products";

const COOKIE = "cart";
const VERSION = 1;
/** Distinct products per cart. Keeps the cookie far below 4 KB. */
export const MAX_LINES = 20;
/** Units of one product per cart, on top of the stock limit. */
export const MAX_QTY = 10;
const MAX_AGE = 60 * 60 * 24 * 30;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slug → quantity, in the order lines were added. */
export type Cart = Record<string, number>;

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 && SLUG.test(value);
}

export function isQuantity(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_QTY;
}

/**
 * The cart from the request cookie. Anything malformed (bad JSON, wrong
 * version, invalid slugs or quantities, too many lines) is dropped rather
 * than trusted; at worst the shopper sees an empty cart.
 */
export async function readCart(): Promise<Cart> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== VERSION
  ) {
    return {};
  }
  const items = (parsed as { items?: unknown }).items;
  if (typeof items !== "object" || items === null || Array.isArray(items)) {
    return {};
  }

  const cart: Cart = {};
  for (const [slug, quantity] of Object.entries(items)) {
    if (Object.keys(cart).length >= MAX_LINES) break;
    // Positive integers are kept but capped; anything else is dropped.
    if (isSlug(slug) && Number.isInteger(quantity) && (quantity as number) >= 1) {
      cart[slug] = Math.min(quantity as number, MAX_QTY);
    }
  }
  return cart;
}

/** Writes the cart cookie (or clears it when empty). Server Actions only. */
export async function writeCart(cart: Cart): Promise<void> {
  const store = await cookies();
  if (Object.keys(cart).length === 0) {
    store.delete(COOKIE);
    return;
  }
  store.set(COOKIE, JSON.stringify({ v: VERSION, items: cart }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Most units of `product` one cart may hold right now. */
export function maxQuantityFor(product: Pick<Product, "stock">): number {
  return Math.max(0, Math.min(product.stock, MAX_QTY));
}

export type CartLine = {
  slug: string;
  /** Missing when the product no longer exists. */
  product?: Product;
  /** What the shopper asked for (as stored in the cookie). */
  quantity: number;
  /** What can actually be bought now: min(quantity, available). */
  purchasableQuantity: number;
  /** Upper bound for the quantity control. */
  maxQuantity: number;
  /** "unavailable": deleted or out of stock; "limited": less stock than asked. */
  issue?: "unavailable" | "limited";
  /** Unit price, whole QAR (from the database, never the client). */
  unitPrice: number;
  /** unitPrice × purchasableQuantity, whole QAR. */
  lineTotal: number;
};

export type CartView = {
  lines: CartLine[];
  /** Sum of line totals, whole QAR. Computed in dirhams to avoid float drift. */
  subtotal: number;
  /** Units the shopper can currently buy. */
  purchasableCount: number;
};

const toDirhams = (qar: number) => Math.round(qar * 100);

/** Pure: joins a cart with live product data and applies the stock rules. */
export function buildCartView(cart: Cart, products: Product[]): CartView {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  let subtotalDirhams = 0;
  let purchasableCount = 0;

  const lines = Object.entries(cart).map(([slug, quantity]): CartLine => {
    const product = bySlug.get(slug);
    const maxQuantity = product ? maxQuantityFor(product) : 0;
    const purchasableQuantity = Math.min(quantity, maxQuantity);
    const unitPrice = product?.price ?? 0;
    const lineDirhams = toDirhams(unitPrice) * purchasableQuantity;
    subtotalDirhams += lineDirhams;
    purchasableCount += purchasableQuantity;

    return {
      slug,
      product,
      quantity,
      purchasableQuantity,
      maxQuantity,
      issue:
        maxQuantity === 0
          ? "unavailable"
          : purchasableQuantity < quantity
            ? "limited"
            : undefined,
      unitPrice,
      lineTotal: lineDirhams / 100,
    };
  });

  return { lines, subtotal: subtotalDirhams / 100, purchasableCount };
}

/**
 * The current cart with live prices and stock. Request-time only (reads the
 * cookie and the database), so render it inside <Suspense>.
 */
/**
 * `held`: units this shopper already has reserved in an unfinished checkout
 * (slug → quantity). They count as available here, because checking out
 * again releases that hold first — otherwise the shopper's own reservation
 * would make their bag look sold out.
 */
export async function getCart({
  held = {},
}: { held?: Record<string, number> } = {}): Promise<CartView> {
  const cart = await readCart();
  // Keep the database query out of prefetch-time prerenders, which run with
  // request cookies but abort in-flight queries when they finish.
  await connection();
  const products = await getLiveProducts(Object.keys(cart));
  return buildCartView(
    cart,
    products.map((p) => (held[p.slug] ? { ...p, stock: p.stock + held[p.slug] } : p)),
  );
}

/** Units in the cart, from the cookie alone (no database read). */
export async function getCartItemCount(): Promise<number> {
  const cart = await readCart();
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
}
