"use server";

import {
  MAX_LINES,
  MAX_QTY,
  isSlug,
  maxQuantityFor,
  readCart,
  writeCart,
} from "@/lib/cart";
import { getHeldQuantities } from "@/lib/orders";
import { getLiveProducts } from "@/lib/products";
import { getSessionUser } from "@/lib/session";

// Cart mutations. Each reads only `slug` (and `quantity`) from the form —
// any other field, such as a price, is ignored — then checks live stock
// before writing the cookie. Prices are never stored; the cart page reads
// them from the database.

export type CartActionState = { ok?: boolean; message?: string };

function slugFrom(formData: FormData): string | undefined {
  const slug = formData.get("slug");
  return isSlug(slug) ? slug : undefined;
}

/** An integer from `min` to MAX_QTY, or undefined. Missing → `fallback`. */
function quantityFrom(
  formData: FormData,
  min: number,
  fallback?: number,
): number | undefined {
  const raw = formData.get("quantity");
  if (raw === null) return fallback;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return undefined;
  const quantity = Number(raw);
  return quantity >= min && quantity <= MAX_QTY ? quantity : undefined;
}

/**
 * Live product data, with any units this shopper holds in an unfinished
 * checkout counted as available (checking out again releases them first).
 */
async function liveProduct(slug: string) {
  const [product] = await getLiveProducts([slug]);
  if (!product) return product;
  const user = await getSessionUser();
  const held = user ? (await getHeldQuantities(user.id))[slug] ?? 0 : 0;
  return held ? { ...product, stock: product.stock + held } : product;
}

export async function addToCart(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const slug = slugFrom(formData);
  const quantity = quantityFrom(formData, 1, 1);
  if (!slug || quantity === undefined) {
    return { ok: false, message: "That item couldn't be added." };
  }

  const product = await liveProduct(slug);
  if (!product) {
    return { ok: false, message: "This item is no longer available." };
  }
  const max = maxQuantityFor(product);
  if (max === 0) return { ok: false, message: "This item is out of stock." };

  const cart = await readCart();
  const current = cart[slug] ?? 0;
  if (current + quantity > max) {
    return {
      ok: false,
      message:
        current > 0
          ? `Only ${max} available — you have ${current} in your bag.`
          : `Only ${max} available.`,
    };
  }
  if (current === 0 && Object.keys(cart).length >= MAX_LINES) {
    return {
      ok: false,
      message: `Your bag can hold ${MAX_LINES} different items. Remove one to add this.`,
    };
  }

  cart[slug] = current + quantity;
  await writeCart(cart);
  return { ok: true, message: "Added to your bag." };
}

export async function setCartQuantity(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const slug = slugFrom(formData);
  // 0 removes the line.
  const quantity = quantityFrom(formData, 0);
  if (!slug || quantity === undefined) {
    return { ok: false, message: `Choose a quantity from 1 to ${MAX_QTY}.` };
  }

  const cart = await readCart();
  if (!(slug in cart)) {
    return { ok: false, message: "This item isn't in your bag any more." };
  }
  if (quantity === 0) {
    delete cart[slug];
    await writeCart(cart);
    return { ok: true };
  }

  const product = await liveProduct(slug);
  const max = product ? maxQuantityFor(product) : 0;
  if (max === 0) {
    return {
      ok: false,
      message: "This item is no longer available. Remove it from your bag.",
    };
  }
  if (quantity > max) {
    return { ok: false, message: `Only ${max} available.` };
  }

  cart[slug] = quantity;
  await writeCart(cart);
  return { ok: true };
}

export async function removeFromCart(formData: FormData): Promise<void> {
  const slug = slugFrom(formData);
  const cart = await readCart();
  if (!slug || !(slug in cart)) return;
  delete cart[slug];
  await writeCart(cart);
}
