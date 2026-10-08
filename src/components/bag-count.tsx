import { getCartItemCount } from "@/lib/cart";

// Units in the bag, beside the header's bag icon. Server-rendered from the
// cart cookie (no database read) and streamed into the static header via
// SiteHeader's `bagCount` slot; render it inside <Suspense>.
export async function BagCount() {
  const count = await getCartItemCount();
  if (count === 0) return null;
  return (
    <>
      <span aria-hidden="true" className="label tabular-nums">
        {count}
      </span>
      <span className="sr-only">
        , {count} {count === 1 ? "item" : "items"}
      </span>
    </>
  );
}
