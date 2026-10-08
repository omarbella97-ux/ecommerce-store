"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { categories, site } from "@/lib/site";
import {
  AccountIcon,
  BagIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
} from "@/components/icons";

// On the home page the header floats transparent over the hero, then turns
// solid and pins to the top once the page scrolls. Elsewhere it is solid.
// `bagCount` is a server-rendered slot (see BagCount in layout.tsx), so the
// header itself stays static and cookie-free.
//
// Reading the pathname suspends while Next.js prerenders routes whose params
// aren't known at build time (e.g. /account/orders/[reference]), so the
// layout wraps SiteHeader in <Suspense> with <SiteHeaderView isHome={false}>
// as the fallback — the same solid header those pages show anyway.
export function SiteHeader({ bagCount }: { bagCount?: React.ReactNode }) {
  return <SiteHeaderView isHome={usePathname() === "/"} bagCount={bagCount} />;
}

export function SiteHeaderView({
  isHome,
  bagCount,
}: {
  isHome: boolean;
  bagCount?: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const state = !isHome ? undefined : scrolled ? "pinned" : "overlay";

  return (
    <>
      <p className="announcement-bar">
        Complimentary delivery and returns on every order
      </p>

      <header className="header-bar" data-state={state}>
        <div className="flex items-center">
          <Link href="/search" className="btn-icon" aria-label="Search">
            <SearchIcon />
          </Link>
        </div>

        <Link href="/" className="heading-lg tracking-tighter">
          {site.name}
        </Link>

        <div className="flex items-center justify-end">
          <Link
            href="/account"
            className="btn-icon max-md:hidden"
            aria-label="Account"
          >
            <AccountIcon />
          </Link>
          <Link href="/cart" className="btn-icon w-auto min-w-11 gap-1 px-1">
            <BagIcon />
            <span className="sr-only">Shopping bag</span>
            {bagCount}
          </Link>
          <button
            type="button"
            className="btn-icon w-auto gap-2 pl-2"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
            <span className="label max-md:sr-only">Menu</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          id="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setMenuOpen(false)}
        >
          <nav
            className="flex h-full w-full max-w-md flex-col bg-canvas text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-header items-center justify-end px-gutter">
              <button
                type="button"
                className="btn-icon"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                autoFocus
              >
                <CloseIcon />
              </button>
            </div>
            <ul className="flex flex-col gap-3 px-gutter pt-6">
              {categories.map((category) => (
                <li key={category.name}>
                  {/* The header persists across navigation, so close the
                      menu when a link is followed. */}
                  <Link
                    href={category.href}
                    className="display text-display-sm link-quiet"
                    onClick={() => setMenuOpen(false)}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-3 border-t px-gutter py-8">
              <Link
                href="/account"
                className="link-quiet"
                onClick={() => setMenuOpen(false)}
              >
                My account
              </Link>
              <a href="#" className="link-quiet">
                Client services
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
