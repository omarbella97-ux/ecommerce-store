"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/(auth)/actions";
import {
  EMAIL_MAX,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  fieldsFor,
  validateAuthForm,
  validateField,
  type AuthField,
  type AuthMode,
  type FieldErrors,
} from "@/lib/auth-validation";

const modes = {
  "sign-in": {
    action: signIn,
    submit: "Sign in",
    pending: "Signing in…",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
    switchHref: "/sign-up",
  },
  "sign-up": {
    action: signUp,
    submit: "Create account",
    pending: "Creating your account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
  },
} as const;

// Underlined field matching the search form; 16px text so iOS doesn't zoom.
// The rule turns `sale` when the field is invalid.
const inputClass =
  "h-12 w-full border-b border-ink bg-transparent text-lead tracking-tight placeholder:text-subtle focus-visible:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-none disabled:text-muted aria-invalid:border-sale aria-invalid:focus-visible:shadow-[0_1px_0_var(--color-sale)]";

// Email/password form for sign-in and sign-up, posting to a Server Action.
// Fields are checked on blur and on submit with the same rules the server
// uses; server errors land on the field they belong to, or in an alert.
// `next` is where to go afterwards (validated on the server).
export function AuthForm({ mode, next }: { mode: AuthMode; next: string }) {
  const config = modes[mode];
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    config.action,
    {},
  );

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<AuthField, true>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // A new server result replaces the field errors shown.
  const [shownState, setShownState] = useState(state);
  if (state !== shownState) {
    setShownState(state);
    setErrors(state.fieldErrors ?? {});
  }

  // Move focus to the first problem the server reported, so keyboard and
  // screen-reader users land on it.
  useEffect(() => {
    const first = fieldsFor(mode).find((f) => state.fieldErrors?.[f]);
    if (first) focusField(formRef.current, first);
    else if (state.error) alertRef.current?.focus();
  }, [state, mode]);

  function check(field: AuthField, value: string) {
    setErrors((prev) => ({ ...prev, [field]: validateField(mode, field, value) }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      fieldsFor(mode).map((f) => [f, String(data.get(f) ?? "")]),
    );
    const found = validateAuthForm(mode, values);
    const first = fieldsFor(mode).find((f) => found[f]);
    setErrors(found);
    setTouched(Object.fromEntries(fieldsFor(mode).map((f) => [f, true])));
    if (first) {
      // Don't send a request we know will fail.
      event.preventDefault();
      focusField(event.currentTarget, first);
    }
  }

  // Blur validates a field once; after that, typing re-checks it so the
  // error clears as soon as it's fixed.
  const fieldProps = (field: AuthField, hint?: string) => ({
    id: field,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": describedBy(field, errors[field], hint),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      if (e.currentTarget.value || touched[field]) check(field, e.currentTarget.value);
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (touched[field] || errors[field]) check(field, e.currentTarget.value);
    },
    className: inputClass,
  });

  const emailTaken = state.emailTaken && errors.email === state.fieldErrors?.email;
  const passwordHint =
    mode === "sign-up" ? `At least ${PASSWORD_MIN} characters.` : undefined;
  const switchHref = `${config.switchHref}?next=${encodeURIComponent(next)}`;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={pending}
      className="w-full"
    >
      <input type="hidden" name="next" value={next} />

      {/* Disabled while the request is in flight: no double submits, no
          edits that wouldn't be sent. */}
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6">
        {state.error && (
          <div
            ref={alertRef}
            role="alert"
            tabIndex={-1}
            className="border border-sale px-4 py-3 text-sale"
          >
            {state.error}
          </div>
        )}

        {mode === "sign-up" && (
          <Field label="Name" field="name" error={errors.name}>
            <input
              {...fieldProps("name")}
              type="text"
              autoComplete="name"
              maxLength={NAME_MAX}
              defaultValue={state.values?.name}
            />
          </Field>
        )}

        <Field
          label="Email"
          field="email"
          error={errors.email}
          action={
            emailTaken && (
              <Link
                href={`/sign-in?next=${encodeURIComponent(next)}`}
                className="link"
              >
                Sign in instead
              </Link>
            )
          }
        >
          <input
            {...fieldProps("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={EMAIL_MAX}
            defaultValue={state.values?.email}
          />
        </Field>

        <Field
          label="Password"
          field="password"
          error={errors.password}
          hint={passwordHint}
        >
          <div className="relative">
            <input
              {...fieldProps("password", passwordHint)}
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              maxLength={PASSWORD_MAX}
              onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onBlurCapture={() => setCapsLock(false)}
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              className="label absolute inset-y-0 right-0 px-1 text-muted hover:text-ink"
              aria-controls="password"
              aria-pressed={showPassword}
              aria-label="Show password"
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p role="status" className="text-caption text-ink empty:hidden">
            {capsLock ? "Caps Lock is on." : ""}
          </p>
        </Field>

        <button type="submit" className="btn btn-primary btn-block">
          {pending ? config.pending : config.submit}
        </button>
      </fieldset>

      {/* Announces the in-flight state; a button's label change isn't read. */}
      <p aria-live="polite" className="sr-only">
        {pending ? config.pending : ""}
      </p>

      <p className="mt-6 text-center text-muted">
        {config.switchPrompt}{" "}
        <Link href={switchHref} className="link text-ink">
          {config.switchLabel}
        </Link>
      </p>
    </form>
  );
}

// An error replaces the hint (it restates the rule), so only one is linked.
const describedBy = (field: AuthField, error?: string, hint?: string) =>
  error ? `${field}-error` : hint ? `${field}-hint` : undefined;

function focusField(form: HTMLFormElement | null, field: AuthField) {
  const element = form?.elements.namedItem(field);
  if (element instanceof HTMLElement) element.focus();
}

// Label, control, then the error if there is one, otherwise the hint. The control carries
// aria-invalid / aria-describedby itself (see fieldProps).
function Field({
  label,
  field,
  hint,
  error,
  action,
  children,
}: {
  label: string;
  field: AuthField;
  hint?: string;
  error?: string;
  /** Inline follow-up after the error, e.g. "Sign in instead". */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={field} className="label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${field}-error`} className="text-caption text-sale">
          {error} {action}
        </p>
      )}
      {hint && !error && (
        <p id={`${field}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
