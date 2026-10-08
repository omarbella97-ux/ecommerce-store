// Server-side Stripe client. Keys come from the environment only (never
// source); prefer a restricted key (rk_…) with just the Checkout Sessions
// permissions this app uses. Throws at import if configuration is missing so
// a misconfigured deploy fails loudly instead of at the first checkout.

import "server-only";
import Stripe from "stripe";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set (see .env.example).`);
  return value;
}

const secretKey = required("STRIPE_SECRET_KEY");
if (/^[sr]k(cs)?_live_/.test(secretKey) && process.env.NODE_ENV !== "production") {
  throw new Error("Refusing to use a live Stripe key outside production.");
}

/** The one Stripe client instance; its API version is pinned by the SDK. */
export const stripe = new Stripe(secretKey);

/** Signing secret for POST /api/stripe/webhook. */
export const stripeWebhookSecret = required("STRIPE_WEBHOOK_SECRET");

/** Absolute origin for Checkout's success and cancel URLs. */
export const appUrl = required("APP_URL").replace(/\/+$/, "");

/** Currency for every order and Checkout Session (prices are in dirhams). */
export const CURRENCY = "qar";

/**
 * How long a Checkout Session (and its stock reservation) stays open. Stripe
 * requires at least 30 minutes after it creates the session; the extra
 * minute covers request latency and clock skew.
 */
export const CHECKOUT_TTL_SECONDS = 31 * 60;
