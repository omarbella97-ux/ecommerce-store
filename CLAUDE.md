# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 (App Router, `src/` dir) · TypeScript · Tailwind v4 · Better Auth · Drizzle ORM · Postgres on Neon. pnpm is the package manager (do not use npm — there is no `package-lock.json`).

## Commands

```bash
pnpm dev                       # dev server (Turbopack) on http://localhost:3000
pnpm build                     # production build (also runs the TypeScript check)
pnpm lint                      # ESLint (flat config, eslint-config-next)
pnpm check:admin               # fail if an admin page/layout/action/helper skips requireAdmin()
pnpm tsc --noEmit              # typecheck only — run `pnpm next typegen` first on a fresh checkout
                               # so the global route types (LayoutProps, PageProps) exist

pnpm db:generate               # drizzle-kit: generate SQL migrations from src/db/schema.ts into ./drizzle
pnpm db:migrate                # apply generated migrations
pnpm db:push                   # push schema directly (no migration files) — don't use; see Database conventions
pnpm db:studio                 # Drizzle Studio
pnpm db:seed                   # upsert the placeholder catalogue (src/db/seed-data.ts); safe to re-run
pnpm dlx auth@latest generate  # Better Auth CLI: emit its required tables into the Drizzle schema
```

There is no test framework configured yet.

## Environment

Copy `.env.example` to `.env.local`. Required: `DATABASE_URL` (Neon connection string), `BETTER_AUTH_SECRET` (≥32 chars), `BETTER_AUTH_URL`. `.gitignore` ignores `.env*` except `.env.example`.

`drizzle.config.ts` loads env via `@next/env`'s `loadEnvConfig`, so drizzle-kit reads the same `.env*` files as Next.js.

## Architecture

- **Database** — `src/db/index.ts` exports a single `db` built on the `drizzle-orm/neon-http` driver (stateless HTTP; interactive transactions are not supported — switch to `drizzle-orm/neon-serverless` with a Pool if those are needed). It imports everything from `src/db/schema.ts` as the schema, so new tables only need to be exported from there (or re-exported from files it imports).- **Auth** — `src/lib/auth.ts` is the server-side Better Auth instance using the Drizzle adapter (`provider: "pg"`) on the shared `db`; email/password is enabled. It passes `secret` explicitly and throws at import if `BETTER_AUTH_SECRET` is missing, under 32 chars, or Better Auth's public default — keep that guard (Better Auth itself only warns, and silently uses the public default outside production). It is mounted at `src/app/api/auth/[...all]/route.ts` via `toNextJsHandler`. Client components use `authClient` from `src/lib/auth-client.ts` (`better-auth/react`). Better Auth's tables (`user`, `session`, `account`, `verification`) live in `src/db/auth-schema.ts`, re-exported from `schema.ts`. Regenerate it with `pnpm dlx auth@latest generate --output src/db/auth-schema.ts` when the auth config gains plugins or fields, switch its timestamps back to `withTimezone: true`, then `db:generate` + `db:migrate` as usual. If the file and the database drift, builds log a "Drizzle schema mismatch" error and auth requests fail.
- **Sessions & authorization** — `src/lib/auth.ts` adds a `role` user field (`"customer" | "admin"`, default `customer`, `input: false` so clients can't set it), 30-day sliding sessions with no `cookieCache` (sign-outs and role changes apply on the next request), and the `nextCookies()` plugin (keep it last) so `auth.api` calls in Server Actions set cookies. Pages and actions never call `auth.api` for reads; they use `src/lib/session.ts` (`server-only`): `getSessionUser`, `requireUser(returnTo)` (redirects to `/sign-in?next=…`), `requireAdmin()` (404 for non-admins) and `safeNext` (same-origin `next` only). These read request headers, so call them inside `<Suspense>`; `getSessionUser` awaits `connection()` so prefetch-time prerenders don't start the DB query. **Every admin page and every admin Server Action must call `requireAdmin()` itself**. `src/proxy.ts` only checks that a session cookie exists for `/account` and `/admin` (for a real 307); it is not authorization. Sign-up/in/out are Server Actions in `src/app/(auth)/actions.ts` with the shared `src/components/auth-form.tsx`. Promote an existing account with `pnpm db:make-admin <email>` (`--revoke` to undo).
- **Admin** — `/admin` redirects (next.config) to `/admin/products` (list, inline stock form, `new`, `[slug]` edit), plus `/admin/categories` and read-only `/admin/orders` (`[reference]`). `src/app/admin/layout.tsx` is a gate: it renders `AdminNav` (`src/components/admin/admin-nav.tsx`) and the page tree only after `requireAdmin()` inside Suspense. Non-admins never get admin data, but a page's static markup can still appear in the RSC stream, so never put secrets in static JSX. In dev, a rejected request logs "Could not validate `instant`"; that is expected. It covers first renders only, because layouts don't re-render on client navigation and never run for actions. So `requireAdmin()` is also called by every page (inside Suspense), first in every action in `src/app/admin/*/actions.ts`, and first in every exported function of `src/lib/admin-catalogue.ts` / `src/lib/admin-orders.ts` (uncached live reads and writes). `pnpm check:admin` (`scripts/check-admin-guards.ts`) enforces this, including `"use server"` files elsewhere that import those helpers; run it before committing admin changes. Hiding the account page's Admin link is cosmetic, not protection. Shared form rules live in `src/lib/admin-validation.ts`; image hosts there must match `images.remotePatterns`. Writes call `updateTag("products")`. Product and category slugs can't be changed after creation. Stock is set with a compare-and-set (`setStock`: `WHERE stock = expected`), so a checkout reservation made meanwhile is never overwritten; every save goes through it, even one that repeats the shown value, and `expected` isn't capped at `STOCK_MAX` (released holds can push live stock above it). `/admin/inventory` lists live Available / Held / On hand, most urgent first, and its `StockForm adjust` also adds or removes units (`adjustStock`: one `UPDATE … SET stock = stock + delta WHERE stock + delta BETWEEN 0 AND STOCK_MAX`, so it never conflicts with checkouts). Both go through the one `updateStock` action (`intent`: `set | sold-out | add | remove`). Admins only change available stock; held units come back via `releaseOrder`. Only empty categories can be deleted. There is no product delete: `order_items` restricts it.
- **Payments (Stripe Checkout, hosted)** — `src/lib/stripe.ts` (`server-only`) holds the one `Stripe` client and throws at import if `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` or `APP_URL` is missing (and refuses live keys outside production). Checkout requires sign-in. `startCheckout()` in `src/app/checkout/actions.ts` takes no input: it expires the user's earlier open sessions and releases their holds, re-checks the bag against live stock, creates a `pending` order priced from Postgres (`createPendingOrder` in `src/lib/orders.ts`), **reserves stock atomically** (`reserveStock`: one statement that sets `orders.reserved_at` and decrements every line, so `CHECK (stock >= 0)` aborts all of it if any line is short; only a pending, unreserved order is reserved), then creates a Checkout Session (`CHECKOUT_TTL_SECONDS` = 31 min, since Stripe needs ≥30 min after it creates the session) with inline `price_data` from the order lines (QAR, dirhams), attaches it only while the order is still pending (otherwise the session is expired), and redirects. Only orders with `reserved_at` set hold stock: `releaseOrder` restocks only those, and Held counts (cart, admin) only those. **Only the verified webhook `POST /api/stripe/webhook` changes payment state** — `checkout.session.completed`/`async_payment_succeeded` → `paid` (when `payment_status` isn't `unpaid`; `review_reason` set on an amount/currency mismatch), `expired`/`async_payment_failed` → release (`releaseOrder`: status change + restock of a reserved order in one statement, only from `pending`; `startCheckout` passes `sessionId` so it only releases an earlier order whose session hasn't changed since it looked). Event ids go in `stripe_events` after processing, so redeliveries are skipped. `/checkout/success` only reads the order (owner only) and polls while pending; `/cart?checkout=canceled` is the cancel URL. Local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. `orders.user_id` is `restrict`, so delete a user's orders before deleting the user.
- **Cart** — no tables: an httpOnly `cart` cookie holds only `{"v":1,"items":{slug: qty}}` (≤20 lines, ≤10 per line), per browser, for guests and signed-in users alike. `src/lib/cart.ts` (`server-only`) parses it strictly (bad entries are dropped, quantities capped), and `getCart()` joins it with `getLiveProducts()` — an **uncached** read in `src/lib/products.ts`, because the `"use cache"` catalogue helpers can be minutes stale — to price lines and apply stock (`purchasableQuantity`, `issue: "limited" | "unavailable"`). The subtotal is summed in dirhams. Mutations are the Server Actions in `src/app/cart/actions.ts`; they read only `slug`/`quantity` from the form (never a price) and re-check live stock every time. The header's count is `BagCount` (cookie only, no DB read), streamed into the static header through `SiteHeader`'s `bagCount` slot — which is why every route builds as partial prerender (◐).
- **Styling** — Tailwind v4 is wired through the `@tailwindcss/turbopack` loader rule in `next.config.ts` (there is no PostCSS config). The whole design system lives in `src/app/globals.css`:
  - `@theme` **resets Tailwind's default colors and radii** — only the project tokens exist (`ink`, `muted`, `surface`, `line`, `line-inverse`, `sale`, …; `rounded-none`/`rounded-full`). `bg-zinc-*`, `rounded-lg`, etc. silently generate nothing. The palette is monochrome — `sale` is the only hue. A bare `border` is a `line` hairline.
  - Visual rules: square corners; product tiles are tinted `surface` cards separated by 1px seams, with square packshots `object-fit: contain` (campaign imagery is cropped with `cover`); tight (negative) tracking on text and headings — never wide letter-spacing (buttons use normal tracking).
  - Responsive values (`--gutter`, `--header-height`, grid gaps) are plain CSS vars switched by media queries in `:root`, then exposed as spacing tokens in `@theme inline` (`px-gutter`, `h-header`, `h-announcement`, `gap-x-tile`, `gap-y-tile-row`).
  - Composite patterns are `@utility` classes (so variants like `md:btn-sm` work): `container-page|bleed|prose`, `section`, `section-tight`, `announcement-bar`, `header-bar` (`data-state="overlay"` over a hero, `"pinned"` once scrolled), `grid-products`, `grid-split`, `grid-layout`, `divider`, `toolbar`, `scroller-x`, `product-tile` (+ `product-eyebrow`, `media-product`, `product-meta` inside it — markup example in the CSS), `media-editorial`, `media-banner`, `media-hero`, product detail: `layout-pdp`, `gallery` (+ `media-gallery` frames), `pdp-panel`, `stock-status` (`data-state="in|low|out"`), `disclosure` (on `<details>`), `scrim`, `heading`, `heading-lg`, `display`, `label`, `btn` + `btn-primary|secondary|inverse|sm|block|icon`, `link`, `link-quiet`, `link-cta`.
  - One typeface: Geist via `next/font` in `src/app/layout.tsx` → `font-sans`. Hierarchy comes from weight and case (`heading` = bold uppercase, `display` = light), not a second family. Light theme only.
- **Catalogue** — products and categories live in Postgres (see Database conventions). Pages only use the helpers in `src/lib/products.ts` (`getProducts`, `getProduct`, `getRelatedProducts`, `stockState`/`stockLabel`, `formatPrice` in QAR). `src/components/product-tile.tsx` is the one listing card; `/products/[slug]` is prerendered via `generateStaticParams`. Photos are temporary Unsplash stock (allowed via `images.remotePatterns` in `next.config.ts`); each product has `images` and an `imageFit` — `"cover"` for photos with their own background, `"contain"` for real packshots on plain backgrounds (sets `data-fit` on `media-product`/`media-gallery`). Store name and categories live in `src/lib/site.ts`.
- **Next config** — `cacheComponents` and `partialPrefetching` are enabled in `next.config.ts`.
- Path alias: `@/*` → `src/*`.

## Database conventions

- **Migrations:** change `src/db/schema.ts`, run `pnpm db:generate`, review the SQL in `drizzle/`, then run `pnpm db:migrate`. Commit the migration files. Never use `db:push`.
- **Columns:** give columns explicit snake_case names in `pgTable` (there is no global `casing` option). Use `integer` identity primary keys. The public identifier is a unique `slug`. Timestamps are `timestamptz`. Index every foreign key, use `onDelete: "restrict"` unless cascading is intended, and declare `relations()` on both sides.
- **Money:** store it as integer minor units (QAR dirhams, ×100), never float or `numeric`. Convert to and from whole QAR only in the read layer's row mapper.
- **Stock:** it is the `products.stock` column, with `CHECK (stock >= 0)`. Move it to its own table only once variants or locations exist.
- **Ordered lists:** a list that is always read whole with its parent (images, detail bullets) goes in a typed `jsonb` column (`.$type<…>()`) or a `text[]` column, not a child table.
- **Keep the schema minimal:** add carts, orders, payments, reviews, wishlists or variants only when they are asked for.
- **Read layer:** pages never import `db`. Queries live in `src/lib/*.ts` helpers that return plain domain types (e.g. `Product`) built by a mapper, not raw rows.
- **Caching:** because `cacheComponents` is on, every DB read helper is a `"use cache"` function with a `cacheTag` (catalogue reads use `"products"`) and a `cacheLife`. Without that, a read outside `<Suspense>` fails the build. Anything that writes catalogue or stock data must call `revalidateTag` with the matching tag.
- **Builds need a database:** `pnpm build` needs `DATABASE_URL` pointing at a migrated, seeded database, because product pages prerender from it.
- **Seed data:** placeholder data lives in `src/db/seed-data.ts`. `src/db/seed.ts` must stay idempotent by upserting on `slug`. `db:seed` runs through `tsx --env-file=.env.local` because `src/db/index.ts` reads `DATABASE_URL` at import time.
- **Driver limits:** the driver is neon-http, so there are no interactive transactions. Use sequential statements or `db.batch` instead.
- **Two kinds of categories:** the `categories` list in `src/lib/site.ts` is header and footer navigation. It is separate from the `categories` table.

## Version note

`next` and `eslint-config-next` are pinned to `16.3.8`. The create-next-app template referenced `16.4.0`, which was not yet published on npm at setup time; keep both packages on the same version when upgrading.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
