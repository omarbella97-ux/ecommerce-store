"use server";

import { updateTag } from "next/cache";
import * as catalogue from "@/lib/admin-catalogue";
import {
  isSlug,
  validateCategoryName,
  validateCategorySlug,
  type CategoryFieldErrors,
} from "@/lib/admin-validation";
import { requireAdmin } from "@/lib/session";

// Category writes. Every action checks the admin role first and reads only
// the fields it expects. Slugs are fixed once created (they are URLs).

export type CategoryFormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: CategoryFieldErrors;
  values?: { slug?: string; name?: string };
};

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();
  const values = { name: text(formData, "name"), slug: text(formData, "slug") };
  const fieldErrors: CategoryFieldErrors = {};
  const nameError = validateCategoryName(values.name);
  const slugError = validateCategorySlug(values.slug);
  if (nameError) fieldErrors.name = nameError;
  if (slugError) fieldErrors.slug = slugError;
  if (nameError || slugError) return { fieldErrors, values };

  const result = await catalogue.createCategory(values);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values };

  updateTag("products");
  // No values: the form clears for the next category.
  return { ok: true, message: `Added ${values.name}.` };
}

export async function renameCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();
  const slug = formData.get("slug");
  const name = text(formData, "name");
  if (!isSlug(slug)) return { error: "This category couldn't be found." };
  const nameError = validateCategoryName(name);
  if (nameError) return { fieldErrors: { name: nameError }, values: { name } };

  const result = await catalogue.renameCategory(slug, name);
  if (!result.ok) return { error: result.error, values: { name } };

  updateTag("products");
  return { ok: true, message: "Saved.", values: { name } };
}

export async function deleteCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();
  const slug = formData.get("slug");
  if (!isSlug(slug)) return { error: "This category couldn't be found." };

  const result = await catalogue.deleteCategory(slug);
  if (!result.ok) return { error: result.error };

  updateTag("products");
  return { ok: true };
}
