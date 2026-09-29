import { readFileSync } from "node:fs";
import path from "node:path";
import {
	authenticatedFetch,
	authenticatedJson,
} from "@/lib/authenticated-request";
import { toMediaItem } from "@/lib/catalog";
import { sessionFromAuth } from "@/lib/auth";
import type { AuthSession } from "@/lib/session";
import { afterEach, describe, expect, it, vi } from "vitest";

type HttpFixture = {
	operationId: string;
	request: {
		method: string;
		pathTemplate: string;
		path: string;
		parameters: Record<string, Record<string, unknown>>;
		body?: { contentType: string; value: unknown };
	};
	response: {
		status: number;
		contentType?: string;
		body?: unknown;
		schemaRef?: string;
	};
};

const fixtureRoot = process.env.ZENSTREAM_API_FIXTURE_ROOT;
const session: AuthSession = {
	token: "fixture-test-token",
	userId: "fixture-user",
	username: "Fixture User",
};

function queryFrom(fixture: HttpFixture) {
	const query = new URLSearchParams();
	for (const [name, value] of Object.entries(
		fixture.request.parameters.query ?? {},
	)) {
		if (value === null || value === undefined) continue;
		if (Array.isArray(value)) {
			for (const item of value) query.append(name, String(item));
		} else {
			query.set(name, String(value));
		}
	}
	return query;
}

function responseFor(fixture: HttpFixture) {
	const response = fixture.response;
	const body =
		response.body === undefined || response.status === 204
			? null
			: response.contentType?.includes("json")
				? JSON.stringify(response.body)
				: String(response.body);
	return new Response(body, {
		status: response.status,
		headers: response.contentType
			? { "Content-Type": response.contentType }
			: undefined,
	});
}

if (!fixtureRoot) {
	describe.skip("shared API contract fixtures", () => {});
} else {
	const fixtureDocument = JSON.parse(
		readFileSync(path.join(fixtureRoot, "http.json"), "utf8"),
	) as { operations: HttpFixture[] };

	describe("shared API contract fixtures", () => {
		afterEach(() => vi.unstubAllGlobals());

		it("sends and parses every documented request through the existing request code", async () => {
			const calls: Array<{ url: string; init?: RequestInit }> = [];
			const fetchMock = vi.fn(
				async (input: RequestInfo | URL, init?: RequestInit) => {
					calls.push({ url: String(input), init });
					const fixture = fixtureDocument.operations[calls.length - 1];
					return responseFor(fixture);
				},
			);
			vi.stubGlobal("fetch", fetchMock);

			for (const fixture of fixtureDocument.operations) {
				const query = queryFrom(fixture);
				const requestPath = `${fixture.request.path}${query.size ? `?${query}` : ""}`;
				const parameterHeaders = fixture.request.parameters.header ?? {};
				const body = fixture.request.body;
				const init: RequestInit = {
					method: fixture.request.method,
				};
				if (body) {
					init.body =
						body.contentType === "application/json"
							? JSON.stringify(body.value)
							: String(body.value);
					init.headers = { "Content-Type": body.contentType };
				}
				if (Object.keys(parameterHeaders).length > 0) {
					init.headers = {
						...(init.headers as Record<string, string> | undefined),
						...Object.fromEntries(
							Object.entries(parameterHeaders).map(([name, value]) => [
								name,
								String(value),
							]),
						),
					};
				}

				if (
					fixture.response.contentType?.includes("json") ||
					fixture.response.status === 204
				) {
					const body = await authenticatedJson<unknown>(session, requestPath, init);
					expect(body, fixture.operationId).toEqual(fixture.response.body ?? null);
				} else {
					const response = await authenticatedFetch(session, requestPath, init);
					expect(response.status, fixture.operationId).toBe(fixture.response.status);
				}
				const call = calls.at(-1);
				const url = new URL(call?.url ?? "");
				expect(url.pathname, fixture.operationId).toBe(fixture.request.path);
				expect([...url.searchParams.entries()].sort(), fixture.operationId).toEqual(
					[...query.entries()].sort(),
				);
				expect(call?.init?.method, fixture.operationId).toBe(
					fixture.request.method,
				);
				if (body?.contentType === "application/json") {
					expect(JSON.parse(String(call?.init?.body)), fixture.operationId).toEqual(
						body.value,
					);
				} else if (body) {
					expect(call?.init?.body, fixture.operationId).toBe(String(body.value));
				} else {
					expect(call?.init?.body, fixture.operationId).toBeUndefined();
				}
			}

			expect(fetchMock).toHaveBeenCalledTimes(fixtureDocument.operations.length);
		});

		it("parses the shared catalog and authentication response examples", () => {
			const catalogPages = fixtureDocument.operations.filter(
				(fixture) =>
					fixture.response.schemaRef === "#/components/schemas/CatalogPage",
			);
			expect(catalogPages.length).toBeGreaterThan(0);
			for (const fixture of catalogPages) {
				const body = fixture.response.body as {
					items: Parameters<typeof toMediaItem>[0][];
				};
				const item = toMediaItem(body.items[0]);
				expect(item.Id, fixture.operationId).toBe("fixture-id");
				expect(item.Name, fixture.operationId).toBe(
					body.items[0].metadata.title || body.items[0].name,
				);
				expect(item.Type, fixture.operationId).toBe("Movie");
				expect(item.UserData.IsFavorite, fixture.operationId).toBe(true);
			}

			const catalogItem = fixtureDocument.operations.find(
				(fixture) =>
					fixture.request.pathTemplate === "/api/catalog/items/{entity_id}" &&
					fixture.request.method === "GET",
			);
			expect(catalogItem).toBeDefined();
			const singleItem = toMediaItem(
				catalogItem?.response.body as Parameters<typeof toMediaItem>[0],
			);
			expect(singleItem.Id).toBe("fixture-id");
			expect(singleItem.Name).toBe("Fixture Item");

			const login = fixtureDocument.operations.find(
				(fixture) => fixture.operationId === "post_api_auth_login",
			);
			expect(login).toBeDefined();
			const parsedSession = sessionFromAuth(login?.response.body as never);
			expect(parsedSession.userId).toBe("fixture-id");
			expect(parsedSession.avatarVersion).toBeNull();
			expect(parsedSession.token).toBe("<redacted>");
		});
	});
}
