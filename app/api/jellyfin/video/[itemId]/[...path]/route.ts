import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string; path: string[] }> }) {
	const { itemId, path } = await params;
	const upstream = new URL(process.env.NEXT_PUBLIC_JELLYFIN_URL || "https://miru.amai.space");
	upstream.pathname = `/Videos/${encodeURIComponent(itemId)}/${path.map((part) => encodeURIComponent(part)).join("/")}`;
	upstream.search = request.nextUrl.search;

	const headers = new Headers();
	for (const name of ["range", "if-none-match", "if-modified-since"]) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	const response = await fetch(upstream, { headers, cache: "no-store" });
	const responseHeaders = new Headers();
	for (const name of ["accept-ranges", "cache-control", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
		const value = response.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}
	return new Response(response.body, { status: response.status, headers: responseHeaders });
}
