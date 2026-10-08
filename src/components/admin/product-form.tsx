"use client";

import { useActionState, useRef, useState } from "react";
import {
  createProduct,
  updateProduct,
  type ProductFormState,
} from "@/app/admin/products/actions";
import {
  ALT_MAX,
  ATTRIBUTE_MAX,
  DESCRIPTION_MAX,
  IMAGE_HOSTS,
  IMAGES_MAX,
  NAME_MAX,
  SLUG_MAX,
  STOCK_MAX,
  STYLE_CODE_MAX,
  TAG_MAX,
  parseProduct,
  productValuesFrom,
  slugify,
  type ProductField,
  type ProductFieldErrors,
  type ProductFormValues,
  type ProductMode,
} from "@/lib/admin-validation";
import type { Category } from "@/lib/products";
import {
  FormField,
  FormMessage,
  describedBy,
  inputClass,
  textareaClass,
} from "./form-field";

const FIELD_ORDER: ProductField[] = [
  "name",
  "slug",
  "category",
  "price",
  "stock",
  "tag",
  "colour",
  "material",
  "styleCode",
  "description",
  "details",
  "images",
  "imageFit",
];

const EMPTY: ProductFormValues = {
  name: "",
  slug: "",
  category: "",
  price: "",
  stock: "0",
  tag: "",
  colour: "",
  material: "",
  styleCode: "",
  description: "",
  details: "",
  imageFit: "contain",
  images: [{ src: "", alt: "" }],
};

type ImageRow = { key: number; src: string; alt: string };
let nextKey = 0;
const toRows = (images: ProductFormValues["images"]): ImageRow[] =>
  (images.length ? images : [{ src: "", alt: "" }]).map((image) => ({ ...image, key: nextKey++ }));

// One form for creating and editing a product. Fields are checked on submit
// with the same rules the server uses; server errors land on their field.
// Inputs are uncontrolled and refill from the last submitted values, so
// React's post-action form reset never loses an admin's edits.
export function ProductForm({
  mode,
  categories,
  initial,
}: {
  mode: ProductMode;
  categories: Category[];
  /** Current values when editing. */
  initial?: ProductFormValues;
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    mode === "create" ? createProduct : updateProduct,
    {},
  );
  const values = state.values ?? initial ?? EMPTY;

  const [errors, setErrors] = useState<ProductFieldErrors>({});
  const [rows, setRows] = useState(() => toRows(values.images));
  const [slugEdited, setSlugEdited] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // A new server result replaces the errors and image rows shown.
  const [shownState, setShownState] = useState(state);
  if (state !== shownState) {
    setShownState(state);
    setErrors(state.fieldErrors ?? {});
    if (state.values) setRows(toRows(state.values.images));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const parsed = parseProduct(mode, productValuesFrom(new FormData(event.currentTarget)));
    if (parsed.ok) {
      setErrors({});
      return;
    }
    // Don't send a request we know will fail.
    event.preventDefault();
    setErrors(parsed.errors);
    const first = FIELD_ORDER.find((f) => parsed.errors[f]);
    const target = first === "images" ? "imageSrc-0" : first;
    const element = target && event.currentTarget.querySelector<HTMLElement>(`#${target}`);
    element?.focus();
  }

  const clear = (field: ProductField) => () =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const fieldProps = (field: ProductField, hint?: string) => ({
    id: field,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": describedBy(field, errors[field], hint),
    onChange: clear(field),
  });

  const hints = {
    slug: "Used in the product URL. It can't be changed later.",
    price:
      mode === "create"
        ? "In QAR, e.g. 1140 or 89.50."
        : "In QAR. Applies to new checkouts; placed orders keep the price they were bought at.",
    stock: "Units available now. Change it later with the stock form.",
    tag: "Optional short label on listing tiles, e.g. New.",
    details: "One bullet per line.",
    images: `First image is the lead image. URLs from ${IMAGE_HOSTS.join(", ")} only.`,
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={pending}
      className="w-full"
    >
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6">
        <FormMessage error={state.error} message={state.message} />

        <FormField id="name" label="Name" error={errors.name}>
          <input
            {...fieldProps("name")}
            type="text"
            maxLength={NAME_MAX}
            defaultValue={values.name}
            className={inputClass}
            onChange={(e) => {
              clear("name")();
              // Suggest a slug from the name until the admin edits it.
              const slug = formRef.current?.elements.namedItem("slug");
              if (mode === "create" && !slugEdited && slug instanceof HTMLInputElement) {
                slug.value = slugify(e.currentTarget.value);
              }
            }}
          />
        </FormField>

        {mode === "create" ? (
          <FormField id="slug" label="Slug" error={errors.slug} hint={hints.slug}>
            <input
              {...fieldProps("slug", hints.slug)}
              type="text"
              maxLength={SLUG_MAX}
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={values.slug}
              className={inputClass}
              onChange={() => {
                clear("slug")();
                setSlugEdited(true);
              }}
            />
          </FormField>
        ) : (
          <input type="hidden" name="slug" value={values.slug} />
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField id="category" label="Category" error={errors.category}>
            <select
              {...fieldProps("category")}
              defaultValue={values.category}
              className={inputClass}
            >
              <option value="" disabled>
                Choose…
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="price" label="Price (QAR)" error={errors.price} hint={hints.price}>
            <input
              {...fieldProps("price", hints.price)}
              type="text"
              inputMode="decimal"
              defaultValue={values.price}
              className={`${inputClass} tabular-nums`}
            />
          </FormField>

          {mode === "create" && (
            <FormField id="stock" label="Initial stock" error={errors.stock} hint={hints.stock}>
              <input
                {...fieldProps("stock", hints.stock)}
                type="number"
                inputMode="numeric"
                min={0}
                max={STOCK_MAX}
                step={1}
                defaultValue={values.stock}
                className={`${inputClass} tabular-nums`}
              />
            </FormField>
          )}

          <FormField id="tag" label="Tag" error={errors.tag} hint={hints.tag}>
            <input
              {...fieldProps("tag", hints.tag)}
              type="text"
              maxLength={TAG_MAX}
              defaultValue={values.tag}
              className={inputClass}
            />
          </FormField>

          <FormField id="colour" label="Colour" error={errors.colour}>
            <input
              {...fieldProps("colour")}
              type="text"
              maxLength={ATTRIBUTE_MAX}
              defaultValue={values.colour}
              className={inputClass}
            />
          </FormField>

          <FormField id="material" label="Material" error={errors.material}>
            <input
              {...fieldProps("material")}
              type="text"
              maxLength={ATTRIBUTE_MAX}
              defaultValue={values.material}
              className={inputClass}
            />
          </FormField>

          <FormField id="styleCode" label="Style code" error={errors.styleCode}>
            <input
              {...fieldProps("styleCode")}
              type="text"
              maxLength={STYLE_CODE_MAX}
              autoCapitalize="characters"
              spellCheck={false}
              defaultValue={values.styleCode}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField id="description" label="Description" error={errors.description}>
          <textarea
            {...fieldProps("description")}
            rows={4}
            maxLength={DESCRIPTION_MAX}
            defaultValue={values.description}
            className={textareaClass}
          />
        </FormField>

        <FormField id="details" label="Details" error={errors.details} hint={hints.details}>
          <textarea
            {...fieldProps("details", hints.details)}
            rows={4}
            defaultValue={values.details}
            className={textareaClass}
          />
        </FormField>

        <fieldset
          className="flex min-w-0 flex-col gap-3"
          aria-describedby={describedBy("images", errors.images, hints.images)}
        >
          <legend className="label mb-1">Images</legend>
          {rows.map((row, i) => (
            <div key={row.key} className="grid items-end gap-3 border-b pb-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={`imageSrc-${i}`} className="text-caption text-muted">
                  Image {i + 1} URL
                </label>
                <input
                  id={`imageSrc-${i}`}
                  name="imageSrc"
                  type="url"
                  inputMode="url"
                  spellCheck={false}
                  defaultValue={row.src}
                  aria-invalid={errors.images ? true : undefined}
                  onChange={clear("images")}
                  className={inputClass}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={`imageAlt-${i}`} className="text-caption text-muted">
                  Image {i + 1} alt text
                </label>
                <input
                  id={`imageAlt-${i}`}
                  name="imageAlt"
                  type="text"
                  maxLength={ALT_MAX}
                  defaultValue={row.alt}
                  aria-invalid={errors.images ? true : undefined}
                  onChange={clear("images")}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={rows.length === 1}
                aria-label={`Remove image ${i + 1}`}
                onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              >
                Remove
              </button>
            </div>
          ))}
          {errors.images ? (
            <p id="images-error" className="text-caption text-sale">
              {errors.images}
            </p>
          ) : (
            <p id="images-hint" className="text-caption text-muted">
              {hints.images}
            </p>
          )}
          {rows.length < IMAGES_MAX && (
            <button
              type="button"
              className="btn btn-secondary btn-sm self-start"
              onClick={() => setRows((prev) => [...prev, { key: nextKey++, src: "", alt: "" }])}
            >
              Add image
            </button>
          )}
        </fieldset>

        <FormField id="imageFit" label="Image framing" error={errors.imageFit}>
          <select {...fieldProps("imageFit")} defaultValue={values.imageFit} className={inputClass}>
            <option value="contain">Contain — packshot on a plain background</option>
            <option value="cover">Cover — photo with its own background</option>
          </select>
        </FormField>

        <button type="submit" className="btn btn-primary btn-block">
          {pending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create product"
              : "Save changes"}
        </button>
      </fieldset>

      <p aria-live="polite" className="sr-only">
        {pending ? "Saving…" : ""}
      </p>
    </form>
  );
}
