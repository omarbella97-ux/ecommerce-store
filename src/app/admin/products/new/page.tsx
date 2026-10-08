import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/product-form";
import { listCategoriesForAdmin } from "@/lib/admin-catalogue";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "New product · Admin",
};

// requireAdmin() gates the page; createProduct checks again on submit.
export default function NewProductPage() {
  return (
    <main className="container-prose section flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-caption text-muted">
        <Link href="/admin/products" className="link-quiet">
          Products
        </Link>
      </nav>
      <h1 className="heading-lg">New product</h1>
      <Suspense fallback={<div className="h-96 animate-pulse bg-surface-strong" aria-busy="true" />}>
        <NewProduct />
      </Suspense>
    </main>
  );
}

async function NewProduct() {
  await requireAdmin("/admin/products/new");
  const categories = await listCategoriesForAdmin();
  if (categories.length === 0) {
    return (
      <p className="text-muted">
        Add a{" "}
        <Link href="/admin/categories" className="link">
          category
        </Link>{" "}
        first — every product belongs to one.
      </p>
    );
  }
  return <ProductForm mode="create" categories={categories} />;
}
