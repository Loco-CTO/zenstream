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
	const isWebVtt = path.at(-1)?.toLowerCase() === "stream.vtt";
	let body: BodyInit | null = response.body;
	if (isWebVtt && response.ok) {
		body = normalizeWebVtt(await response.text());
	}
	const responseHeaders = new Headers();
	for (const name of ["accept-ranges", "cache-control", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
		if (isWebVtt && name === "content-length") continue;
		const value = response.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}
	return new Response(body, { status: response.status, headers: responseHeaders });
}

function normalizeWebVtt(input: string) {
	const blocks = input.replace(/^WEBVTT[^\n]*\r?\n/i, "").split(/\r?\n\s*\r?\n/);
	const groups = new Map<string, number>();
	return `WEBVTT\n\n${blocks.map((block) => {
		const lines = block.split(/\r?\n/);
		const timingIndex = lines.findIndex((line) => line.includes(" --> "));
		if (timingIndex < 0) return block;
		const timing = lines[timingIndex];
		if (/\s(?:line|position|size|align):/.test(timing)) return block;
		const [start, end] = timing.split(" --> ");
		const key = `${start}|${end}`;
		const line = -(groups.get(key) ?? 1) - 1;
		groups.set(key, (line * -1));
		lines[timingIndex] = `${timing} line:${line}`;
		return lines.join("\n");
	}).join("\n\n")}\n`;
}
