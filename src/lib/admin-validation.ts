// Admin form rules for products, stock and categories, shared by the forms
// (instant feedback) and the Server Actions (the real check), so both give
// the same message. Pure functions: safe to import from client components.

export type ProductMode = "create" | "edit";

export type ProductField =
  | "name"
  | "slug"
  | "category"
  | "price"
  | "stock"
  | "tag"
  | "colour"
  | "material"
  | "styleCode"
  | "description"
  | "details"
  | "images"
  | "imageFit";

export type ProductFieldErrors = Partial<Record<ProductField, string>>;

/** Raw form values, as strings — what the form sends and refills. */
export type ProductFormValues = Record<Exclude<ProductField, "images">, string> & {
  images: { src: string; alt: string }[];
};

/** A validated product, ready for the write layer. Price is whole QAR. */
export type ProductInput = {
  name: string;
  slug: string;
  categorySlug: string;
  price: number;
  stock: number;
  tag: string | null;
  colour: string;
  material: string;
  styleCode: string;
  description: string;
  details: string[];
  images: { src: string; alt: string }[];
  imageFit: "contain" | "cover";
};

export const NAME_MAX = 120;
export const SLUG_MAX = 80;
export const TAG_MAX = 24;
export const ATTRIBUTE_MAX = 60;
export const STYLE_CODE_MAX = 40;
export const DESCRIPTION_MAX = 2000;
export const DETAILS_MAX = 12;
export const DETAIL_MAX = 200;
export const IMAGES_MAX = 8;
export const ALT_MAX = 200;
export const PRICE_MAX = 1_000_000;
export const STOCK_MAX = 100_000;
export const CATEGORY_NAME_MAX = 60;

/** Keep in sync with `images.remotePatterns` in next.config.ts (see imageSrcError). */
export const IMAGE_HOSTS = ["images.unsplash.com"];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STYLE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const PRICE_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const STOCK_PATTERN = /^\d+$/;
// Static segments under /admin/products that a product slug would shadow.
const RESERVED_SLUGS = new Set(["new"]);

export const isSlug = (value: unknown): value is string =>
  typeof value === "string" && value.length <= SLUG_MAX && SLUG_PATTERN.test(value);

/** "Linen Shirt — Ecru" → "linen-shirt-ecru", to suggest a slug from a name. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

function slugError(value: string, what: string): string | undefined {
  if (!value) return `Enter a ${what} slug.`;
  if (value.length > SLUG_MAX) return `Use ${SLUG_MAX} characters or fewer.`;
  if (!SLUG_PATTERN.test(value)) {
    return "Use lower-case letters, numbers and single hyphens, like linen-shirt.";
  }
}

function requiredText(value: string, label: string, max: number): string | undefined {
  if (!value) return `Enter ${label}.`;
  if (value.length > max) return `Use ${max} characters or fewer.`;
}

/** An integer from 0 to STOCK_MAX, or the error to show. */
export function parseStock(raw: string): { stock: number } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: "Enter a stock quantity." };
  if (!STOCK_PATTERN.test(value) || Number(value) > STOCK_MAX) {
    return { error: `Enter a whole number from 0 to ${STOCK_MAX.toLocaleString("en")}.` };
  }
  return { stock: Number(value) };
}

export type StockDirection = "add" | "remove";

/**
 * How many units to add or remove: a whole number from 1 to STOCK_MAX (the
 * button picks the direction, so no sign). Returns the signed change, or the
 * error to show. Whether the result stays within 0…STOCK_MAX is checked by
 * the update itself, against live stock.
 */
export function parseStockDelta(
  raw: string,
  direction: StockDirection,
): { delta: number } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: "Enter how many units to add or remove." };
  if (!STOCK_PATTERN.test(value) || Number(value) > STOCK_MAX) {
    return { error: `Enter a whole number from 1 to ${STOCK_MAX.toLocaleString("en")}.` };
  }
  if (Number(value) === 0) return { error: "Enter a change other than 0." };
  return { delta: direction === "remove" ? -Number(value) : Number(value) };
}

/**
 * Mirrors `images.remotePatterns` (`new URL("https://images.unsplash.com/**")`):
 * that pattern allows no port and no query string, and next/image throws on
 * any src it doesn't match — which would take the product page down.
 */
function imageSrcError(src: string): string | undefined {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return "Each image needs a full https:// URL.";
  }
  if (url.protocol !== "https:" || !IMAGE_HOSTS.includes(url.hostname)) {
    return `Images must be hosted on ${IMAGE_HOSTS.join(" or ")}.`;
  }
  if (url.port || url.username || url.password || url.search || url.hash || url.pathname === "/") {
    return "Use the image's plain URL, without ?query parameters, like https://images.unsplash.com/photo-….";
  }
}

/** Reads only the product fields from a form; anything else is ignored. */
export function productValuesFrom(formData: FormData): ProductFormValues {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const all = (name: string) =>
    formData.getAll(name).map((v) => (typeof v === "string" ? v : ""));
  const srcs = all("imageSrc");
  const alts = all("imageAlt");
  return {
    name: text("name"),
    slug: text("slug"),
    category: text("category"),
    price: text("price"),
    stock: text("stock"),
    tag: text("tag"),
    colour: text("colour"),
    material: text("material"),
    styleCode: text("styleCode"),
    description: text("description"),
    details: text("details"),
    imageFit: text("imageFit"),
    images: srcs.map((src, i) => ({ src, alt: alts[i] ?? "" })),
  };
}

/**
 * Checks every field. On success returns the cleaned input; the slug and
 * stock are only checked (and only meaningful) when creating — after that
 * the slug is fixed and stock changes through the stock form.
 */
export function parseProduct(
  mode: ProductMode,
  values: ProductFormValues,
): { ok: true; input: ProductInput } | { ok: false; errors: ProductFieldErrors } {
  const errors: ProductFieldErrors = {};
  const name = values.name.trim();
  const slug = values.slug.trim();
  const category = values.category.trim();
  const price = values.price.trim();
  const tag = values.tag.trim();
  const colour = values.colour.trim();
  const material = values.material.trim();
  const styleCode = values.styleCode.trim();
  const description = values.description.trim();
  const details = values.details
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // Rows left completely blank are ignored.
  const images = values.images
    .map(({ src, alt }) => ({ src: src.trim(), alt: alt.trim() }))
    .filter(({ src, alt }) => src || alt);

  const set = (field: ProductField, error: string | undefined) => {
    if (error) errors[field] = error;
  };

  set("name", requiredText(name, "a product name", NAME_MAX));
  let stock = 0;
  if (mode === "create") {
    set(
      "slug",
      slugError(slug, "product") ??
        (RESERVED_SLUGS.has(slug) ? `"${slug}" is reserved. Choose another slug.` : undefined),
    );
    const parsed = parseStock(values.stock);
    if ("error" in parsed) set("stock", parsed.error);
    else stock = parsed.stock;
  }
  set("category", isSlug(category) ? undefined : "Choose a category.");
  if (!price) set("price", "Enter a price in QAR.");
  else if (!PRICE_PATTERN.test(price) || Number(price) > PRICE_MAX) {
    set("price", `Enter an amount from 0 to ${PRICE_MAX.toLocaleString("en")}, with up to 2 decimals.`);
  }
  if (tag.length > TAG_MAX) set("tag", `Use ${TAG_MAX} characters or fewer.`);
  set("colour", requiredText(colour, "a colour", ATTRIBUTE_MAX));
  set("material", requiredText(material, "a material", ATTRIBUTE_MAX));
  set(
    "styleCode",
    requiredText(styleCode, "a style code", STYLE_CODE_MAX) ??
      (STYLE_CODE_PATTERN.test(styleCode)
        ? undefined
        : "Use letters, numbers and hyphens, like MS-1001."),
  );
  set("description", requiredText(description, "a description", DESCRIPTION_MAX));
  if (details.length > DETAILS_MAX) set("details", `Use ${DETAILS_MAX} lines or fewer.`);
  else if (details.some((d) => d.length > DETAIL_MAX)) {
    set("details", `Keep each line to ${DETAIL_MAX} characters or fewer.`);
  }
  if (images.length === 0) set("images", "Add at least one image.");
  else if (images.length > IMAGES_MAX) set("images", `Use ${IMAGES_MAX} images or fewer.`);
  else {
    const problem = images
      .map(({ src, alt }) =>
        !src
          ? "Each image needs a URL."
          : (imageSrcError(src) ??
            (!alt
              ? "Describe each image (alt text)."
              : alt.length > ALT_MAX
                ? `Keep alt text to ${ALT_MAX} characters or fewer.`
                : undefined)),
      )
      .find(Boolean);
    set("images", problem);
  }
  if (values.imageFit !== "contain" && values.imageFit !== "cover") {
    set("imageFit", "Choose how images are framed.");
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name,
      slug,
      categorySlug: category,
      price: Number(price),
      stock,
      tag: tag || null,
      colour,
      material,
      styleCode,
      description,
      details,
      images,
      imageFit: values.imageFit as "contain" | "cover",
    },
  };
}

export type CategoryField = "name" | "slug";
export type CategoryFieldErrors = Partial<Record<CategoryField, string>>;

export function validateCategoryName(raw: string): string | undefined {
  return requiredText(raw.trim(), "a category name", CATEGORY_NAME_MAX);
}

export function validateCategorySlug(raw: string): string | undefined {
  return slugError(raw.trim(), "category");
}
