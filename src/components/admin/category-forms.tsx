"use client";

import { useActionState } from "react";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  type CategoryFormState,
} from "@/app/admin/categories/actions";
import { CATEGORY_NAME_MAX, SLUG_MAX } from "@/lib/admin-validation";
import { FormField, FormMessage, describedBy, inputClass } from "./form-field";

// Category forms. The server repeats every check (and the admin check);
// deleting needs no confirm dialog because a category with products is
// refused, and an empty one holds nothing to lose.

export function NewCategoryForm() {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(
    createCategory,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const slugHint = "Used in the category URL. It can't be changed later.";

  return (
    <form action={formAction} noValidate aria-busy={pending} className="w-full">
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
        <legend className="heading mb-2">New category</legend>
        <FormMessage error={state.error} message={state.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="new-category-name" label="Name" error={errors.name}>
            <input
              id="new-category-name"
              name="name"
              type="text"
              maxLength={CATEGORY_NAME_MAX}
              defaultValue={state.values?.name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("new-category-name", errors.name)}
              className={inputClass}
            />
          </FormField>
          <FormField id="new-category-slug" label="Slug" error={errors.slug} hint={slugHint}>
            <input
              id="new-category-slug"
              name="slug"
              type="text"
              maxLength={SLUG_MAX}
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={state.values?.slug}
              aria-invalid={errors.slug ? true : undefined}
              aria-describedby={describedBy("new-category-slug", errors.slug, slugHint)}
              className={inputClass}
            />
          </FormField>
        </div>
        <button type="submit" className="btn btn-primary self-start">
          {pending ? "Adding…" : "Add category"}
        </button>
      </fieldset>
    </form>
  );
}

export function CategoryRow({
  slug,
  name,
  productCount,
}: {
  slug: string;
  name: string;
  productCount: number;
}) {
  const [renameState, renameAction, renaming] = useActionState<CategoryFormState, FormData>(
    renameCategory,
    {},
  );
  const [deleteState, deleteAction, deleting] = useActionState<CategoryFormState, FormData>(
    deleteCategory,
    {},
  );
  const inputId = `category-${slug}`;
  const error = renameState.fieldErrors?.name ?? renameState.error ?? deleteState.error;
  const messageId = `${inputId}-message`;

  return (
    <li className="flex flex-col gap-2 border-b py-4">
      <div className="flex flex-wrap items-end gap-3">
        <form action={renameAction} className="flex min-w-0 flex-1 items-end gap-3">
          <input type="hidden" name="slug" value={slug} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={inputId} className="text-caption text-muted">
              /{slug} · {productCount} {productCount === 1 ? "product" : "products"}
            </label>
            <input
              id={inputId}
              name="name"
              type="text"
              maxLength={CATEGORY_NAME_MAX}
              defaultValue={renameState.values?.name ?? name}
              disabled={renaming}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || renameState.message ? messageId : undefined}
              className={inputClass}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={renaming}>
            {renaming ? "Saving…" : "Rename"}
          </button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={deleting || productCount > 0}
            title={productCount > 0 ? "Only empty categories can be deleted" : undefined}
            aria-label={`Delete ${name}`}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
      <p
        id={messageId}
        role="status"
        className={`text-caption empty:hidden ${error ? "text-sale" : "text-muted"}`}
      >
        {error ?? renameState.message ?? ""}
      </p>
    </li>
  );
}
