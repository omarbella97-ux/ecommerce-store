import { getOrderBySessionForUser } from "@/lib/orders";
import { getSessionUser } from "@/lib/session";

// GET /api/checkout/status?session_id=cs_… → { status } for the signed-in
// user's own order. Polled by the confirmation page while payment is being
// confirmed, so the page only re-renders once the status actually changes
// (a router refresh per poll would also re-prefetch every visible link).
// Read-only: the status itself is only ever set by the Stripe webhook.
export async function GET(request: Request): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  const user = await getSessionUser();
  if (!user || !sessionId?.startsWith("cs_")) {
    return Response.json({ status: null }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const order = await getOrderBySessionForUser(sessionId, user.id);
  return Response.json(
    { status: order?.status ?? null },
    { status: order ? 200 : 404, headers: { "Cache-Control": "no-store" } },
  );
}
