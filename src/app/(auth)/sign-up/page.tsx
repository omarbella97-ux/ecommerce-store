import type { Metadata } from "next";
import { AuthPage } from "../auth-page";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
};

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <AuthPage
      mode="sign-up"
      title="Create an account"
      intro="Sign up to view your account."
      searchParams={searchParams}
    />
  );
}
