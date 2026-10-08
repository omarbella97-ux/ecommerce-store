// Grants or revokes the admin role for an existing account. Safe to re-run.
//   pnpm db:make-admin you@example.com
//   pnpm db:make-admin you@example.com --revoke
// Takes effect on the user's next request (sessions aren't cookie-cached).

import { eq } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

  if (!email) {
    console.error("Usage: pnpm db:make-admin <email> [--revoke]");
    process.exit(1);
  }

  const role = revoke ? "customer" : "admin";
  const [updated] = await db
    .update(user)
    .set({ role })
    .where(eq(user.email, email))
    .returning({ email: user.email, role: user.role });

  if (!updated) {
    console.error(`No account with email ${email}. Sign up first.`);
    process.exit(1);
  }

  console.log(`${updated.email} is now ${updated.role}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
