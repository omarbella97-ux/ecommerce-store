import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryRow, NewCategoryForm } from "@/components/admin/category-forms";
import { listCategoriesForAdmin } from "@/lib/admin-catalogue";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Categories · Admin",
};

// requireAdmin() gates the page; each category action checks again.
// These are the catalogue categories (the `categories` table). Header and
// footer navigation is a separate list in src/lib/site.ts.
export default function AdminCategoriesPage() {
  return (
    <main className="container-prose section flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="heading-lg">Categories</h1>
        <p className="text-caption text-muted">
          Store navigation is configured separately; a new category gets its own page at
          /categories/&lt;slug&gt;.
        </p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse bg-surface-strong" aria-busy="true" />}>
        <Categories />
      </Suspense>
    </main>
  );
}

async function Categories() {
  await requireAdmin("/admin/categories");
  const categories = await listCategoriesForAdmin();

  return (
    <>
      {categories.length === 0 ? (
        <p className="text-muted">No categories yet.</p>
      ) : (
        <ul className="flex flex-col border-t">
          {categories.map((category) => (
            // Keyed by name too, so a rename elsewhere refreshes the input.
            <CategoryRow key={`${category.slug}:${category.name}`} {...category} />
          ))}
        </ul>
      )}
      <div className="border-t pt-6">
        <NewCategoryForm />
      </div>
    </>
  );
}
