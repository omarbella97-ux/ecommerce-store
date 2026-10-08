// Sign-in / sign-up field rules, shared by the form (instant feedback) and
// the Server Actions (the real check), so both give the same message.

export type AuthMode = "sign-in" | "sign-up";
export type AuthField = "name" | "email" | "password";
export type FieldErrors = Partial<Record<AuthField, string>>;

export const NAME_MAX = 100;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8; // matches minPasswordLength in src/lib/auth.ts
export const PASSWORD_MAX = 128;

// Deliberately loose: something@something.tld. Better Auth validates again.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateField(
  mode: AuthMode,
  field: AuthField,
  raw: string,
): string | undefined {
  switch (field) {
    case "name": {
      const value = raw.trim();
      if (!value) return "Enter your name.";
      if (value.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`;
      return;
    }
    case "email": {
      const value = raw.trim();
      if (!value) return "Enter your email address.";
      if (value.length > EMAIL_MAX || !EMAIL_PATTERN.test(value)) {
        return "Enter a valid email address, like name@example.com.";
      }
      return;
    }
    case "password":
      if (!raw) return mode === "sign-up" ? "Choose a password." : "Enter your password.";
      // Sign-in only checks presence: whether it's right is the server's call,
      // and accounts made under older length rules must still get in.
      if (mode === "sign-up") {
        if (raw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
        if (raw.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
      }
      return;
  }
}

export function fieldsFor(mode: AuthMode): AuthField[] {
  return mode === "sign-up" ? ["name", "email", "password"] : ["email", "password"];
}

export function validateAuthForm(
  mode: AuthMode,
  values: Partial<Record<AuthField, string>>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fieldsFor(mode)) {
    const error = validateField(mode, field, values[field] ?? "");
    if (error) errors[field] = error;
  }
  return errors;
}
