import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";

// Better Auth signs session cookies and email-verification JWTs with this
// secret. Left unset it silently falls back to a public default outside
// production, and it accepts any configured value with at most a warning —
// so enforce a real secret here, in every environment.
const PUBLIC_DEFAULT_SECRET = "better-auth-secret-12345678901234567890";
const MIN_SECRET_LENGTH = 32;

function requireAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`.",
    );
  }
  if (secret === PUBLIC_DEFAULT_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is Better Auth's public default.");
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate one with \`openssl rand -base64 32\`.`,
    );
  }
  return secret;
}

const DAY = 60 * 60 * 24;

export const auth = betterAuth({
  secret: requireAuthSecret(),
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // "customer" | "admin". `input: false` keeps it out of sign-up and
      // update-user requests; promote with `pnpm db:make-admin <email>`.
      role: {
        type: "string",
        required: true,
        defaultValue: "customer",
        input: false,
      },
    },
  },
  session: {
    // Persistent cookie, renewed at most once a day while in use. No
    // cookieCache: every session read hits the database, so sign-outs and
    // role changes apply on the next request.
    expiresIn: 30 * DAY,
    updateAge: DAY,
  },
  // Must stay last: lets auth.api calls in Server Actions set cookies.
  plugins: [nextCookies()],
});
