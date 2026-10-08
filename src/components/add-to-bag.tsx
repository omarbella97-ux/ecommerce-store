"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToCart, type CartActionState } from "@/app/cart/actions";

// Product page purchase button. Sends only the slug; the server checks live
// stock and the cart page prices it from the database. `soldOut` comes from
// the (cached) product data and only disables the button — the action is the
// real check.
export function AddToBag({ slug, soldOut }: { slug: string; soldOut: boolean }) {
  const [state, formAction, pending] = useActionState<CartActionState, FormData>(
    addToCart,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={soldOut || pending}
      >
        {soldOut ? "Out of stock" : pending ? "Adding…" : "Add to bag"}
      </button>

      {/* Live regions stay mounted so each new message is announced. */}
      <p role="status" className="text-center text-caption empty:hidden">
        {state.ok && (
          <>
            {state.message}{" "}
            <Link href="/cart" className="link">
              View bag
            </Link>
          </>
        )}
      </p>
      <p role="alert" className="text-center text-caption text-sale empty:hidden">
        {state.ok === false ? state.message : null}
      </p>
    </form>
  );
}
