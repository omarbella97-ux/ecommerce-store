import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser, safeNext } from "@/lib/session";

type Mode = "sign-in" | "sign-up";

// Shared frame for the sign-in and sign-up pages. The title renders in the
// static shell; `searchParams` and the session are read inside Suspense.
export function AuthPage({
  mode,
  title,
  intro,
  searchParams,
}: {
  mode: Mode;
  title: string;
  intro: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="container-prose section flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="heading-lg">{title}</h1>
        <p className="text-muted">{intro}</p>
      </div>
      <Suspense fallback={<FormSkeleton mode={mode} />}>
        <AuthFormForRequest mode={mode} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AuthFormForRequest({
  mode,
  searchParams,
}: {
  mode: Mode;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  // Already signed in: skip the form.
  if (await getSessionUser()) redirect(next);

  return <AuthForm mode={mode} next={next} />;
}

// Same height as the form so nothing shifts when it streams in.
function FormSkeleton({ mode }: { mode: Mode }) {
  const fields = mode === "sign-up" ? 3 : 2;
  return (
    <div className="flex w-full animate-pulse flex-col gap-6" aria-busy="true">
      <span className="sr-only">Loading</span>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-1" aria-hidden="true">
          <div className="h-4 w-16 bg-surface-strong" />
          <div className="h-12 border-b" />
        </div>
      ))}
      <div className="h-12 bg-surface-strong" aria-hidden="true" />
    </div>
  );
}
