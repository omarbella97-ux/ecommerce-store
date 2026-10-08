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
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Better Auth's tables (user, session, account, verification). Regenerate with
// `pnpm dlx auth@latest generate --output src/db/auth-schema.ts` when its
// config gains plugins or fields.
export * from "./auth-schema";

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

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}));

export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;

// ---------------------------------------------------------------------------
// Orders. Prices and totals are copied from `products` on the server when an
// order is created; nothing here comes from the browser. Payment state moves
// only through Stripe webhooks (see src/lib/orders.ts).
// ---------------------------------------------------------------------------

/**
 * pending  — stock reserved, waiting for Stripe to confirm payment
 * paid     — Stripe confirmed payment (webhook); stock stays taken
 * expired  — checkout abandoned or replaced; reserved stock returned
 * failed   — Stripe reported the payment failed; reserved stock returned
 * canceled — never reached payment (stock unavailable or Stripe error)
 */
export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "expired",
  "failed",
  "canceled",
]);

/** Shipping details as Stripe Checkout collected them (copied when paid). */
export type ShippingDetails = {
  name: string | null;
  phone: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
};

export const orders = pgTable(
  "orders",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /** Public identifier shown to customers and sent to Stripe (MSN-…). */
    reference: text("reference").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    /** ISO 4217, lower case as Stripe uses it. */
    currency: text("currency").notNull().default("qar"),
    /** QAR minor units (dirhams), summed from order_items. */
    subtotal: integer("subtotal").notNull(),
    /** What Stripe is asked to charge, in dirhams (= subtotal for now). */
    total: integer("total").notNull(),
    /** Set once the Checkout Session exists; unique so a session maps to one order. */
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    /** Set when Stripe reports the payment (webhook). */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /** Email Stripe confirmed the receipt went to (defaults to the account email). */
    email: text("email").notNull(),
    shipping: jsonb("shipping").$type<ShippingDetails>(),
    /** Set when Stripe's paid amount or currency doesn't match this order. */
    reviewReason: text("review_reason"),
    /**
     * Set in the same statement that takes the order's stock. Only orders
     * with it set have stock to give back when released.
     */
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    /** When the stock reservation lapses (the Checkout Session's expires_at). */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("orders_user_id_idx").on(t.userId),
    check("orders_subtotal_non_negative", sql`${t.subtotal} >= 0`),
    check("orders_total_non_negative", sql`${t.total} >= 0`),
    // A paid order always records when and through which payment.
    check(
      "orders_paid_has_payment",
      sql`${t.status} <> 'paid' OR (${t.paidAt} IS NOT NULL AND ${t.stripePaymentIntentId} IS NOT NULL)`,
    ),
  ],
);

/**
 * One product line of an order. Name and unit price are snapshots taken when
 * the order was created, so later catalogue changes don't rewrite history.
 * A child table (not jsonb) because each line needs a real foreign key to
 * `products` for releasing reserved stock.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productSlug: text("product_slug").notNull(),
    name: text("name").notNull(),
    /** QAR minor units (dirhams) at the time of the order. */
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    unique("order_items_order_product_unique").on(t.orderId, t.productId),
    check("order_items_unit_price_non_negative", sql`${t.unitPrice} >= 0`),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/**
 * Stripe webhook events already processed, by event id. Lets the webhook
 * acknowledge redeliveries without acting twice, and keeps an audit trail.
 */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

// Kept here rather than in the generated auth-schema.ts, which the Better Auth
// CLI overwrites; Drizzle merges relations declared for the same table.
export const userOrdersRelations = relations(user, ({ many }) => ({
  orders: many(orders),
}));

export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
