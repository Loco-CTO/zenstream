import { beforeEach, describe, expect, it } from "vitest";
import {
	getLastNonPlayerPath,
	isPlayerPath,
	rememberLastNonPlayerPath,
} from "@/lib/player-navigation";

describe("player navigation", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("recognizes player routes without matching similarly named routes", () => {
		expect(isPlayerPath("/play/movie")).toBe(true);
		expect(isPlayerPath("/play")).toBe(true);
		expect(isPlayerPath("/player/movie")).toBe(false);
	});

	it("remembers the latest non-player route", () => {
		rememberLastNonPlayerPath(
			"/show/series/episode/episode-1?seasonId=season-1",
		);

		expect(getLastNonPlayerPath()).toBe(
			"/show/series/episode/episode-1?seasonId=season-1",
		);
	});

	it("does not replace the return route when a player route is active", () => {
		rememberLastNonPlayerPath("/library");
		rememberLastNonPlayerPath("/play/episode-2");

		expect(getLastNonPlayerPath()).toBe("/library");
	});

	it("falls back home when no valid return route exists", () => {
		sessionStorage.setItem("zenstream:last-non-player-path", "/play/episode-1");

		expect(getLastNonPlayerPath()).toBe("/");
	});
});
