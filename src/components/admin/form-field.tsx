// Label, control, then the error if there is one, otherwise the hint — the
// same layout as the auth form's fields. The control sets aria-invalid and
// aria-describedby itself (use `describedBy`).

// Underlined field matching the auth and search forms; 16px text so iOS
// doesn't zoom. The rule turns `sale` when the field is invalid.
export const inputClass =
  "h-12 w-full border-b border-ink bg-transparent text-lead tracking-tight placeholder:text-subtle focus-visible:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-none disabled:text-muted aria-invalid:border-sale aria-invalid:focus-visible:shadow-[0_1px_0_var(--color-sale)]";

export const textareaClass =
  "min-h-28 w-full border border-ink bg-transparent p-3 text-lead tracking-tight placeholder:text-subtle focus-visible:shadow-[0_0_0_1px_var(--color-ink)] focus-visible:outline-none disabled:text-muted aria-invalid:border-sale";

/** An error replaces the hint (it restates the rule), so only one is linked. */
export const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function FormField({
  id,
  label,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-caption text-sale">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Form-level message: an alert for errors, a polite status for success. */
export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <div role="alert" className="border border-sale px-4 py-3 text-sale">
        {error}
      </div>
    );
  }
  return (
    <p role="status" className="text-caption text-ink empty:hidden">
      {message ?? ""}
    </p>
  );
}
