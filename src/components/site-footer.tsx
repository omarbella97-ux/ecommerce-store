import Link from "next/link";
import { categories, site } from "@/lib/site";

// Links to pages that don't exist yet.
const placeholders = (names: string[]) =>
  names.map((name) => ({ name, href: "#" }));

const columns = [
  { title: "Shop", links: categories },
  {
    title: "Client services",
    links: placeholders(["Contact us", "Shipping", "Returns", "Care guide", "FAQ"]),
  },
  {
    title: "The house",
    links: placeholders(["About", "Stores", "Careers", "Sustainability"]),
  },
  {
    title: "Legal",
    links: placeholders(["Terms", "Privacy", "Cookies", "Accessibility"]),
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="container-bleed section-tight grid grid-cols-2 gap-x-gutter gap-y-10 md:grid-cols-4">
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="label mb-4">{column.title}</h2>
            <ul className="flex flex-col gap-2 text-caption text-muted">
              {column.links.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="link-quiet hover:text-ink">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container-bleed flex flex-col gap-2 border-t py-6 text-caption text-subtle md:flex-row md:items-center md:justify-between">
        <p>© {site.name}. All rights reserved.</p>
        <p>Qatar · English</p>
      </div>
    </footer>
  );
}
