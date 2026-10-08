"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { validateAuthForm, type FieldErrors } from "@/lib/auth-validation";
import { safeNext } from "@/lib/session";

/**
 * Returned to the form on failure: a form-level `error`, per-field
 * `fieldErrors`, and `values` to refill the non-secret fields.
 */
export type AuthFormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  /** Sign-up only: the email already has an account (offer sign-in). */
  emailTaken?: boolean;
  values?: { name?: string; email?: string };
};

const TOO_MANY = "Too many attempts. Wait a minute and try again.";
const UNEXPECTED = "Something went wrong on our side. Please try again.";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = field(formData, "name").trim();
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const values = { name, email };

  const fieldErrors = validateAuthForm("sign-up", { name, email, password });
  if (hasErrors(fieldErrors)) return { fieldErrors, values };

  try {
    // Only these fields are sent; `role` is input: false and defaults to
    // "customer" regardless.
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
  } catch (error) {
    if (!isAPIError(error)) {
      console.error("sign-up failed", error);
      return { error: UNEXPECTED, values };
    }
    if (error.statusCode === 429) return { error: TOO_MANY, values };

    switch (error.body?.code) {
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        return {
          fieldErrors: { email: "An account already exists for this email." },
          emailTaken: true,
          values,
        };
      case "INVALID_EMAIL":
        return {
          fieldErrors: {
            email: "Enter a valid email address, like name@example.com.",
          },
          values,
        };
      case "PASSWORD_TOO_SHORT":
      case "PASSWORD_TOO_LONG":
        return {
          fieldErrors: { password: error.body?.message ?? "Choose another password." },
          values,
        };
      default:
        return { error: "We couldn't create your account. Please try again.", values };
    }
  }

  // autoSignIn is on, so the session cookie is already set.
  redirect(safeNext(formData.get("next")));
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const values = { email };

  const fieldErrors = validateAuthForm("sign-in", { email, password });
  if (hasErrors(fieldErrors)) return { fieldErrors, values };

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (error) {
    if (!isAPIError(error)) {
      console.error("sign-in failed", error);
      return { error: UNEXPECTED, values };
    }
    if (error.statusCode === 429) return { error: TOO_MANY, values };
    // One message for every credential failure, so it can't reveal which
    // emails have accounts.
    return { error: "Incorrect email or password.", values };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
