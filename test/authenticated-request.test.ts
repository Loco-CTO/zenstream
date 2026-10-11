import { afterEach, describe, expect, it, vi } from "vitest";
import { validateBrowserSession } from "@/lib/media-api";
import {
	authenticatedFetch,
	getRefreshAttemptId,
	orchestratorBaseUrl,
} from "@/lib/authenticated-request";
import { clearAuthCookies, setAuthCookies } from "@/lib/session";

const session = { token: "", userId: "user-1", username: "Alex" };
const refreshAttemptIdKey = () =>
	`zenstream.auth-refresh-attempt-id:${new URL(orchestratorBaseUrl()).origin}`;

function createSharedIndexedDb() {
	const values = new Map<string, unknown>();
	let objectStoreCreated = false;
	let transactionTail: Promise<void> = Promise.resolve();
	const database = {
		objectStoreNames: {
			contains: (name: string) => name === "attempts" && objectStoreCreated,
		},
		createObjectStore: vi.fn((name: string) => {
			if (name === "attempts") objectStoreCreated = true;
			return {};
		}),
		close: vi.fn(),
		transaction: vi.fn(() => {
			const operations: Array<() => void> = [];
			const transaction = {
				objectStore: vi.fn(() => ({
					get: vi.fn((key: string) => {
						const request: {
							result: unknown;
							onsuccess: ((event: Event) => void) | null;
						} = { result: undefined, onsuccess: null };
						operations.push(() => {
							request.result = values.get(key);
							request.onsuccess?.(new Event("success"));
						});
						return request;
					}),
					put: vi.fn((value: unknown, key: string) => {
						operations.push(() => values.set(key, value));
						return {};
					}),
				})),
				oncomplete: null as ((event: Event) => void) | null,
			};

			const previous = transactionTail;
			let release!: () => void;
			transactionTail = new Promise<void>((resolve) => {
				release = resolve;
			});
			queueMicrotask(async () => {
				await previous;
				for (const operation of operations) {
					operation();
					await Promise.resolve();
				}
				transaction.oncomplete?.(new Event("complete"));
				release();
			});
			return transaction;
		}),
	};
	const factory = {
		open: vi.fn(() => {
			const request: {
				result: typeof database;
				onupgradeneeded: ((event: Event) => void) | null;
				onsuccess: ((event: Event) => void) | null;
			} = {
				result: database,
				onupgradeneeded: null,
				onsuccess: null,
			};
			queueMicrotask(() => {
				if (!objectStoreCreated)
					request.onupgradeneeded?.(new Event("upgradeneeded"));
				request.onsuccess?.(new Event("success"));
			});
			return request;
		}),
	} as unknown as IDBFactory;
	return { factory, values };
}

afterEach(() => {
	vi.restoreAllMocks();
	clearAuthCookies();
	window.localStorage.removeItem(refreshAttemptIdKey());
});

describe("browser authentication transport", () => {
	it("includes cookies and reports the originating session on protected 401s", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 401 }));
		const expired = vi.fn();
		window.addEventListener("zenstream:auth-expired", expired);

		await authenticatedFetch(session, "/api/catalog/home");

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/catalog/home"),
			expect.objectContaining({
				credentials: "include",
				headers: expect.objectContaining({ Accept: "application/json" }),
			}),
		);
		expect(expired).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { session } }),
		);
		window.removeEventListener("zenstream:auth-expired", expired);
	});

	it("validates the HttpOnly browser session without recursively emitting expiry", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ user: { id: "fresh", username: "Fresh" } }), {
				status: 200,
			}),
		);

		await expect(validateBrowserSession(session)).resolves.toEqual({
			token: "",
			userId: "fresh",
			username: "Fresh",
		});
	});

	it("single-flights browser refresh and retries concurrent 401s once", async () => {
		let protectedRequests = 0;
		let refreshRequests = 0;
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/api/auth/refresh")) {
					refreshRequests += 1;
					return new Response(JSON.stringify({ user: { id: "user-1" } }), {
						status: 200,
					});
				}
				protectedRequests += 1;
				return new Response(null, {
					status: protectedRequests <= 2 ? 401 : 200,
				});
			});

		const responses = await Promise.all([
			authenticatedFetch(session, "/api/catalog/home"),
			authenticatedFetch(session, "/api/catalog/libraries"),
		]);

		expect(responses.every((response) => response.ok)).toBe(true);
		expect(refreshRequests).toBe(1);
		expect(protectedRequests).toBe(4);
		expect(fetchMock.mock.calls[2][1]).toEqual(
			expect.objectContaining({
				credentials: "include",
				headers: expect.objectContaining({
					"X-ZenStream-Auth-Flow": "refresh-v1",
				}),
			}),
		);
	});

	it("serializes first-use refresh ID creation across tabs with empty storage", async () => {
		window.localStorage.removeItem(refreshAttemptIdKey());
		const previousLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
		const previousIndexedDB = Object.getOwnPropertyDescriptor(
			window,
			"indexedDB",
		);
		Object.defineProperty(window, "indexedDB", {
			configurable: true,
			value: undefined,
		});
		let lockTail = Promise.resolve();
		const locks = {
			request: vi.fn(
				async (_name: string, callback: () => Promise<string> | string) => {
					const previous = lockTail;
					let release!: () => void;
					lockTail = new Promise<void>((resolve) => {
						release = resolve;
					});
					await previous;
					try {
						return await callback();
					} finally {
						release();
					}
				},
			),
		};
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: locks,
		});

		try {
			const tabOneGetId = getRefreshAttemptId;
			vi.resetModules();
			const { getRefreshAttemptId: tabTwoGetId } =
				await import("@/lib/authenticated-request");
			const [tabOneId, tabTwoId] = await Promise.all([
				tabOneGetId(),
				tabTwoGetId(),
			]);

			expect(tabOneId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
			);
			expect(tabTwoId).toBe(tabOneId);
			expect(window.localStorage.getItem(refreshAttemptIdKey())).toBe(tabOneId);
			expect(locks.request).toHaveBeenCalledTimes(2);
			expect(locks.request).toHaveBeenCalledWith(
				expect.stringContaining("zenstream:auth-refresh-attempt-id"),
				expect.any(Function),
			);
		} finally {
			if (previousLocks) Object.defineProperty(navigator, "locks", previousLocks);
			else Reflect.deleteProperty(navigator, "locks");
			if (previousIndexedDB)
				Object.defineProperty(window, "indexedDB", previousIndexedDB);
			else Reflect.deleteProperty(window, "indexedDB");
		}
	});

	it("shares a first-use refresh attempt ID across tabs without Web Locks", async () => {
		window.localStorage.removeItem(refreshAttemptIdKey());
		const previousLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
		const previousIndexedDB = Object.getOwnPropertyDescriptor(
			window,
			"indexedDB",
		);
		const indexedDb = createSharedIndexedDb();
		Object.defineProperty(window, "indexedDB", {
			configurable: true,
			value: indexedDb.factory,
		});
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: undefined,
		});

		let releaseRefreshes!: () => void;
		const bothRefreshesStarted = new Promise<void>((resolve) => {
			releaseRefreshes = resolve;
		});
		const refreshAttemptIds: string[] = [];
		let rotated = false;
		let familyRevoked = false;
		let acceptedAttemptId: string | undefined;
		const protectedAttempts = new Map<string, number>();
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.includes("/api/auth/refresh")) {
					const body = JSON.parse(String(init?.body ?? "{}")) as {
						refreshAttemptId?: string;
					};
					refreshAttemptIds.push(body.refreshAttemptId ?? "");
					if (refreshAttemptIds.length === 2) releaseRefreshes();
					await bothRefreshesStarted;

					if (acceptedAttemptId === undefined) {
						acceptedAttemptId = body.refreshAttemptId;
						rotated = true;
					} else if (body.refreshAttemptId !== acceptedAttemptId) {
						familyRevoked = true;
					}
					return new Response(null, {
						status: familyRevoked ? 401 : 200,
					});
				}

				const attempts = (protectedAttempts.get(url) ?? 0) + 1;
				protectedAttempts.set(url, attempts);
				return new Response(null, {
					status: attempts === 1 || !rotated || familyRevoked ? 401 : 200,
				});
			});

		try {
			const tabOneFetch = authenticatedFetch;
			vi.resetModules();
			const { authenticatedFetch: tabTwoFetch } =
				await import("@/lib/authenticated-request");
			const responses = await Promise.all([
				tabOneFetch(session, "/api/catalog/home"),
				tabTwoFetch(session, "/api/catalog/libraries"),
			]);

			expect(responses.every((response) => response.ok)).toBe(true);
			expect(refreshAttemptIds).toHaveLength(2);
			expect(refreshAttemptIds[0]).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
			);
			expect(refreshAttemptIds[1]).toBe(refreshAttemptIds[0]);
			expect(familyRevoked).toBe(false);
			const nextAttemptId = window.localStorage.getItem(refreshAttemptIdKey());
			expect(nextAttemptId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
			);
			expect(nextAttemptId).not.toBe(refreshAttemptIds[0]);
			expect(indexedDb.values.get(refreshAttemptIdKey())).toBe(nextAttemptId);
			const refreshCalls = fetchMock.mock.calls.filter(([input]) =>
				String(input).includes("/api/auth/refresh"),
			);
			expect(
				refreshCalls.map(([, init]) => JSON.parse(String(init?.body ?? "{}"))),
			).toEqual([
				{ refreshAttemptId: refreshAttemptIds[0] },
				{ refreshAttemptId: refreshAttemptIds[0] },
			]);
			expect(
				refreshCalls.every(([, init]) => init?.credentials === "include"),
			).toBe(true);
		} finally {
			if (previousLocks) Object.defineProperty(navigator, "locks", previousLocks);
			else Reflect.deleteProperty(navigator, "locks");
			if (previousIndexedDB)
				Object.defineProperty(window, "indexedDB", previousIndexedDB);
			else Reflect.deleteProperty(window, "indexedDB");
		}
	});

	it("rechecks protected requests under the cross-tab refresh lock", async () => {
		const previousLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
		const lockTails = new Map<string, Promise<void>>();
		const locks = {
			request: vi.fn(
				async (name: string, callback: () => Promise<Response | string>) => {
					const previous = lockTails.get(name) ?? Promise.resolve();
					let release!: () => void;
					lockTails.set(
						name,
						new Promise<void>((resolve) => {
							release = resolve;
						}),
					);
					await previous;
					try {
						return await callback();
					} finally {
						release();
					}
				},
			),
		};
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: locks,
		});
		let refreshed = false;
		let refreshRequests = 0;
		const protectedAttempts = new Map<string, number>();
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/api/auth/refresh")) {
					refreshRequests += 1;
					refreshed = true;
					return new Response(null, { status: 200 });
				}
				const attempt = (protectedAttempts.get(url) ?? 0) + 1;
				protectedAttempts.set(url, attempt);
				return new Response(null, {
					status: attempt === 1 || !refreshed ? 401 : 200,
				});
			});

		try {
			const responses = await Promise.all([
				authenticatedFetch(session, "/api/catalog/home"),
				authenticatedFetch(session, "/api/catalog/libraries"),
			]);

			expect(responses.every((response) => response.ok)).toBe(true);
			expect(refreshRequests).toBe(1);
			expect(
				[...protectedAttempts.values()].reduce((sum, count) => sum + count, 0),
			).toBe(5);
			const lockNames = locks.request.mock.calls.map(([name]) => name);
			expect(
				lockNames.filter((name) => name.startsWith("zenstream:auth-refresh:")),
			).toHaveLength(2);
			expect(
				lockNames.filter((name) =>
					name.startsWith("zenstream:auth-refresh-attempt-id:"),
				),
			).toHaveLength(1);
			expect(fetchMock).toHaveBeenCalled();
		} finally {
			if (previousLocks) Object.defineProperty(navigator, "locks", previousLocks);
			else Reflect.deleteProperty(navigator, "locks");
		}
	});

	it("does not clear the session when refresh is unavailable", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) =>
				String(input).includes("/api/auth/refresh")
					? new Response(null, { status: 503 })
					: new Response(null, { status: 401 }),
			);
		const expired = vi.fn();
		window.addEventListener("zenstream:auth-expired", expired);

		const response = await authenticatedFetch(session, "/api/catalog/home");

		expect(response.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(expired).not.toHaveBeenCalled();
		window.removeEventListener("zenstream:auth-expired", expired);
	});

	it("keeps startup validation retryable when refresh is unavailable", async () => {
		vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) =>
				String(input).includes("/api/auth/refresh")
					? new Response(null, { status: 503 })
					: new Response(null, { status: 401 }),
			);

		await expect(validateBrowserSession(session)).rejects.toThrow(
			"Could not refresh the browser session.",
		);
	});

	it("does not persist a bearer token in readable cookies", () => {
		setAuthCookies({ token: "secret", userId: "user-1", username: "Alex" });
		expect(document.cookie).not.toContain("token=");
	});
});
