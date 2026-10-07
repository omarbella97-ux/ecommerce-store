import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Better Auth tables can be generated with: pnpm dlx auth@latest generate

/** One image in a product's ordered gallery; the first is the lead image. */
export type ProductImageData = { src: string; alt: string };

/**
 * "contain" for packshots on a plain background; "cover" for photos with
 * their own background (sets data-fit on media-product / media-gallery).
 */
export const imageFit = pgEnum("image_fit", ["contain", "cover"]);

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    /** QAR minor units (dirhams): 11400 QAR is stored as 1140000. */
    price: integer("price").notNull(),
    /** Units available; drives the stock state. */
    stock: integer("stock").notNull().default(0),
    /** Short corner tag on listing tiles (New, Exclusive, …). */
    tag: text("tag"),
    colour: text("colour").notNull(),
    material: text("material").notNull(),
    styleCode: text("style_code").notNull().unique(),
    description: text("description").notNull(),
    details: text("details")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    images: jsonb("images")
      .$type<ProductImageData[]>()
      .notNull()
      .default([]),
    imageFit: imageFit("image_fit").notNull().default("contain"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_category_id_idx").on(t.categoryId),
    check("products_price_non_negative", sql`${t.price} >= 0`),
    check("products_stock_non_negative", sql`${t.stock} >= 0`),
  ],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
