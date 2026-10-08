ALTER TABLE "orders" ADD COLUMN "reserved_at" timestamp with time zone;--> statement-breakpoint
-- Existing orders that got a Checkout Session had already reserved their stock
-- (the session is only created after a successful reservation).
UPDATE "orders" SET "reserved_at" = "created_at" WHERE "stripe_checkout_session_id" IS NOT NULL;
