import type { Metadata } from "next";
import { AuthPage } from "../auth-page";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthPage
      mode="sign-in"
      title="Sign in"
      intro="Welcome back."
      searchParams={searchParams}
    />
  );
}
