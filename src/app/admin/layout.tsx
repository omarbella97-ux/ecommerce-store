import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false },
};

// The admin layout is a gate: the admin nav and the page tree render only
// after requireAdmin() passes. Non-admins (and forged cookies that get past
// src/proxy.ts) get a neutral placeholder, then a 404 or a redirect to
// sign-in. Next still serializes a child page's static markup (headings,
// button labels) in the RSC stream, since segments render independently —
// that holds no data (every data read is behind requireAdmin), and the admin
// client components are public JS anyway. In dev, such a rejected request
// logs "Could not validate `instant`": the validator can't render a page
// whose layout redirected. That's expected; admins don't trigger it.
//
// It is NOT the only check. A layout doesn't re-render on client navigation
// between admin pages, and never runs for Server Actions — so every admin
// page and every admin action still calls requireAdmin() itself
// (`pnpm check:admin` enforces this).
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<AdminShellSkeleton />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}

// No links or labels: the static shell must not reveal the admin area.
function AdminShellSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="toolbar" aria-hidden="true">
        <div className="h-4 w-48 bg-surface-strong" />
      </div>
    </div>
  );
}
