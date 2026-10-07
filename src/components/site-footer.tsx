import { categories, site } from "@/lib/site";

const columns = [
  { title: "Shop", links: categories },
  {
    title: "Client services",
    links: ["Contact us", "Shipping", "Returns", "Care guide", "FAQ"],
  },
  { title: "The house", links: ["About", "Stores", "Careers", "Sustainability"] },
  { title: "Legal", links: ["Terms", "Privacy", "Cookies", "Accessibility"] },
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
                <li key={link}>
                  <a href="#" className="link-quiet hover:text-ink">
                    {link}
                  </a>
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
