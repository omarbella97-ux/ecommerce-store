"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import * as catalogue from "@/lib/admin-catalogue";
import {
  isSlug,
  parseProduct,
  parseStock,
  parseStockDelta,
  productValuesFrom,
  STOCK_MAX,
  type ProductFieldErrors,
  type ProductFormValues,
  type StockDirection,
} from "@/lib/admin-validation";
import { requireAdmin } from "@/lib/session";

// Product and stock writes. Every action checks the admin role first — a
// Server Action is a public endpoint, so the page's own check doesn't cover
// it — and reads only the fields it expects from the form.

export type ProductFormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: ProductFieldErrors;
  values?: ProductFormValues;
};

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();
  const values = productValuesFrom(formData);
  const parsed = parseProduct("create", values);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const result = await catalogue.createProduct(parsed.input);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values };

  updateTag("products");
  redirect(`/admin/products/${parsed.input.slug}`);
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();
  // The slug identifies the product and is never changed here.
  const slug = formData.get("slug");
  if (!isSlug(slug)) return { error: "This product couldn't be found." };
  const values = { ...productValuesFrom(formData), slug };
  const parsed = parseProduct("edit", values);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const result = await catalogue.updateProduct(slug, parsed.input);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values };

  updateTag("products");
  return { ok: true, message: "Changes saved.", values };
}

export type StockFormState = {
  ok?: boolean;
  message?: string;
  /** Stock in the database after this attempt, when known. */
  stock?: number;
  /** Which input the message is about (defaults to the stock count). */
  field?: "stock" | "delta";
};

const STOCK_INTENTS = ["set", "sold-out", "add", "remove"] as const;
type StockIntent = (typeof STOCK_INTENTS)[number];
const isStockIntent = (value: unknown): value is StockIntent =>
  STOCK_INTENTS.includes(value as StockIntent);

const RELOAD = "Reload the page and try again.";

// "set" / "sold-out" write an absolute value only if stock is still what the
// page showed; "add" / "remove" change live stock by a number of units, so a
// checkout reserving units meanwhile doesn't make them conflict.
export async function updateStock(
  _prev: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  await requireAdmin();
  const slug = formData.get("slug");
  const intent = formData.get("intent") ?? "set";
  if (!isSlug(slug) || !isStockIntent(intent)) return { ok: false, message: RELOAD };
  if (intent === "add" || intent === "remove") return adjust(slug, intent, formData);

  // What the page showed. Capped at the column's range, not STOCK_MAX:
  // released holds return on top of live stock, which can then be above it.
  const expected = String(formData.get("expected") ?? "").trim();
  if (!/^\d{1,10}$/.test(expected) || Number(expected) > 2_147_483_647) {
    return { ok: false, message: RELOAD };
  }
  // "Mark sold out" ignores the number field.
  const next = intent === "sold-out" ? { stock: 0 } : parseStock(String(formData.get("stock") ?? ""));
  if ("error" in next) return { ok: false, message: next.error };

  // Always written, even when it equals `expected`: the compare-and-set is
  // what tells the admin that live stock changed since the page loaded.
  const result = await catalogue.setStock(slug, { expected: Number(expected), next: next.stock });
  if (!result.ok) {
    return result.reason === "changed"
      ? {
          ok: false,
          stock: result.stock,
          message: `Stock changed to ${result.stock} since this page loaded (a checkout or another admin). Check it and save again.`,
        }
      : { ok: false, message: "This product no longer exists." };
  }

  updateTag("products");
  return {
    ok: true,
    message: result.stock === 0 ? "Marked sold out." : `Saved — ${result.stock} available.`,
    stock: result.stock,
  };
}

// Not exported, so not an action of its own: only reachable through
// updateStock, after its requireAdmin().
async function adjust(
  slug: string,
  direction: StockDirection,
  formData: FormData,
): Promise<StockFormState> {
  const parsed = parseStockDelta(String(formData.get("delta") ?? ""), direction);
  if ("error" in parsed) return { ok: false, message: parsed.error, field: "delta" };

  const result = await catalogue.adjustStock(slug, parsed.delta);
  if (!result.ok) {
    if (result.reason === "missing") return { ok: false, message: "This product no longer exists." };
    return {
      ok: false,
      field: "delta",
      stock: result.stock,
      message:
        parsed.delta < 0
          ? `Only ${result.stock} available — can't remove ${-parsed.delta}.`
          : `Stock can't go above ${STOCK_MAX.toLocaleString("en")} (${result.stock} available now).`,
    };
  }

  updateTag("products");
  const units = Math.abs(parsed.delta);
  return {
    ok: true,
    stock: result.stock,
    message: `${parsed.delta > 0 ? "Added" : "Removed"} ${units} — ${result.stock} available.`,
  };
}
