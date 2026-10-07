# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 (App Router, `src/` dir) · TypeScript · Tailwind v4 · Better Auth · Drizzle ORM · Postgres on Neon. pnpm is the package manager (do not use npm — there is no `package-lock.json`).

## Commands

```bash
pnpm dev                       # dev server (Turbopack) on http://localhost:3000
pnpm build                     # production build (also runs the TypeScript check)
pnpm lint                      # ESLint (flat config, eslint-config-next)
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

- **Database** — `src/db/index.ts` exports a single `db` built on the `drizzle-orm/neon-http` driver (stateless HTTP; interactive transactions are not supported — switch to `drizzle-orm/neon-serverless` with a Pool if those are needed). It imports everything from `src/db/schema.ts` as the schema, so new tables only need to be exported from there (or re-exported from files it imports).- **Auth** — `src/lib/auth.ts` is the server-side Better Auth instance using the Drizzle adapter (`provider: "pg"`) on the shared `db`; email/password is enabled. It is mounted at `src/app/api/auth/[...all]/route.ts` via `toNextJsHandler`. Client components use `authClient` from `src/lib/auth-client.ts` (`better-auth/react`). Better Auth's tables (`user`, `session`, `account`, `verification`) do not exist yet — until they are generated into the schema and pushed/migrated, builds log a "Drizzle schema mismatch" error and auth requests will fail.
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
