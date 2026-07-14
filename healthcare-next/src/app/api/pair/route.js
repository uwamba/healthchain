// Minimal in-memory relay for the "show a QR on the desktop, patient's phone
// scans it and sends their address back" pairing flow (see AddressInput.js
// and app/pair/[id]/page.js). A session is just {address, createdAt} keyed
// by a short id, held in a module-scope Map — this only needs to survive
// for the few seconds a phone takes to scan and tap "Send", not persist
// across server restarts, so no real database is needed.
//
// `globalThis` (not a plain module-level `const`) so the Map survives
// Next.js dev's hot-reload re-evaluating this module.
const sessions = globalThis.__healthchainPairSessions || (globalThis.__healthchainPairSessions = new Map());
const TTL_MS = 5 * 60 * 1000;

function cleanupExpired() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > TTL_MS) sessions.delete(id);
  }
}

export async function POST() {
  cleanupExpired();
  const id = crypto.randomUUID().slice(0, 8);
  sessions.set(id, { address: null, createdAt: Date.now() });
  return Response.json({ id });
}

export async function GET(request) {
  cleanupExpired();
  const id = new URL(request.url).searchParams.get("id");
  const session = sessions.get(id);
  if (!session) {
    return Response.json({ error: "Session not found or expired" }, { status: 404 });
  }
  return Response.json({ address: session.address });
}

export async function PATCH(request) {
  const { id, address } = await request.json();
  const session = sessions.get(id);
  if (!session) {
    return Response.json({ error: "Session not found or expired" }, { status: 404 });
  }
  session.address = address;
  return Response.json({ ok: true });
}
