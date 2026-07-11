import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
	return proxyLocale("GET");
}

export async function PATCH(request: Request) {
	return proxyLocale("PATCH", await request.text());
}

async function proxyLocale(method: "GET" | "PATCH", body?: string) {
	const token = (await cookies()).get("token")?.value;
	const baseUrl = process.env.NEXT_PUBLIC_ZSO_URL?.replace(/\/+$/, "");
	if (!token)
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	if (!baseUrl)
		return NextResponse.json(
			{ error: "NEXT_PUBLIC_ZSO_URL is not configured." },
			{ status: 503 },
		);

	try {
		const response = await fetch(
			`${baseUrl}/api/zenstream/preferences/locale`,
			{
				method,
				headers: {
					"X-Jellyfin-Token": token,
					...(body ? { "Content-Type": "application/json" } : {}),
				},
				body,
				cache: "no-store",
			},
		);
		return new NextResponse(await response.text(), {
			status: response.status,
			headers: {
				"Content-Type":
					response.headers.get("Content-Type") ?? "application/json",
			},
		});
	} catch {
		return NextResponse.json(
			{ error: "ZenStream Orchestrator is unavailable." },
			{ status: 502 },
		);
	}
}
