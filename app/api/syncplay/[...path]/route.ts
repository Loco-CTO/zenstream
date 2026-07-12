import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get("token")?.value;
  const username = (await cookies()).get("username")?.value;
  const base = process.env.NEXT_PUBLIC_ZSO_URL?.replace(/\/+$/, "");
  if (!token || !base) return NextResponse.json({ error: "Syncplay is unavailable." }, { status: token ? 503 : 401 });
  const path = (await context.params).path.join("/");
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  const headers = { "X-Jellyfin-Token": token, "X-ZenStream-Username": username ?? "ZenStream", ...(body ? { "Content-Type": "application/json" } : {}) };
  // The orchestrator is reached over the public network. A short connection
  // reset must not turn a play/pause/seek into a lost command. Playback and
  // presence requests carry operation IDs and are idempotent server-side, so
  // retrying the same body is safe even when the first request was committed
  // before its response was lost.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/zenstream/syncplay/${path}`, { method: request.method, headers, body, cache: "no-store" });
      if (response.status >= 500 && response.status <= 599 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        continue;
      }
      return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        continue;
      }
    }
  }
  return NextResponse.json({ error: "ZenStream Orchestrator is unavailable." }, { status: 502 });
}
export const GET = proxy; export const POST = proxy; export const PATCH = proxy; export const DELETE = proxy;
