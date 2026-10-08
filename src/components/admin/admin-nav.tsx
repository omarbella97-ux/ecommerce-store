"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
] as const;

// Admin section links. Rendered only by the admin layout's gate, after
// requireAdmin() — never in the static shell. Nested routes highlight their
// section (/admin/products/new → Products).
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="toolbar">
      <div className="flex min-w-0 items-center gap-6">
        <p className="label text-muted">Admin</p>
        <ul className="scroller-x flex gap-6">
          {sections.map((section) => {
            const active =
              pathname === section.href || pathname.startsWith(`${section.href}/`);
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? "link font-medium" : "link-quiet text-muted"}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <Link href="/" className="link-quiet shrink-0 text-muted">
        View store
      </Link>
    </nav>
  );
}
