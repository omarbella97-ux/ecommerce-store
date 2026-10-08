// Server-side session reads. Pages and Server Actions only use these helpers,
// never `auth.api` directly. Reads are per request (React `cache`), never
// "use cache": authorization must not come from a shared cache. Because they
// read request headers, call them inside a <Suspense> boundary.

import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type Role = "customer" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/** The signed-in user, or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Wait for a real request. Without this, prefetch-time prerenders (Partial
  // Prefetching renders with request headers) start the session query and
  // abort it mid-flight, which Better Auth logs as a failed query.
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role: role === "admin" ? "admin" : "customer" };
});

/** The signed-in user; otherwise redirects to sign-in, then back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * The signed-in admin. Signed-out visitors go to sign-in; signed-in
 * non-admins get a 404, so the admin area isn't revealed. Every admin page
 * and every admin Server Action must call this first.
 */
export async function requireAdmin(returnTo = "/admin"): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "admin") notFound();
  return user;
}

const DEFAULT_NEXT = "/account";

/**
 * A post-sign-in destination limited to same-origin paths ("/…"), so `next`
 * can't redirect off-site ("//evil.com", "/\evil.com", "https://…"). Control
 * characters are rejected too: browsers strip them, so "/\t/evil.com" would
 * become "//evil.com".
 */
export function safeNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return DEFAULT_NEXT;
  }
  return value;
}
