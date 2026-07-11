import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get("token")?.value;
  const username = (await cookies()).get("username")?.value;
  const base = process.env.NEXT_PUBLIC_ZSO_URL?.replace(/\/+$/, "");
  if (!token || !base) return NextResponse.json({ error: "Syncplay is unavailable." }, { status: token ? 503 : 401 });
  const path = (await context.params).path.join("/");
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  try {
    const response = await fetch(`${base}/api/zenstream/syncplay/${path}`, { method: request.method, headers: { "X-Jellyfin-Token": token, "X-ZenStream-Username": username ?? "ZenStream", ...(body ? { "Content-Type": "application/json" } : {}) }, body, cache: "no-store" });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
  } catch { return NextResponse.json({ error: "ZenStream Orchestrator is unavailable." }, { status: 502 }); }
}
export const GET = proxy; export const POST = proxy; export const PATCH = proxy; export const DELETE = proxy;
