import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppRouteShell } from "@/components/app-route-shell";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
const shellState = vi.hoisted(() => ({ mounts: 0 }));

vi.mock("next/navigation", () => ({
	usePathname: () => navigation.pathname,
}));

function TestShell() {
	const [mountId] = useState(() => ++shellState.mounts);
	return <div data-testid="app-shell">mount-{mountId}</div>;
}

describe("app route shell", () => {
	it("keeps the shell mounted while navigating between app routes", () => {
		navigation.pathname = "/";
		shellState.mounts = 0;
		const shell = <TestShell />;
		const view = render(
			<AppRouteShell shell={shell}>
				<div data-testid="public-page">public page</div>
			</AppRouteShell>,
		);

		expect(screen.getByTestId("app-shell")).toHaveTextContent("mount-1");

		navigation.pathname = "/library";
		view.rerender(
			<AppRouteShell shell={shell}>
				<div data-testid="public-page">public page</div>
			</AppRouteShell>,
		);
		navigation.pathname = "/album/album-1";
		view.rerender(
			<AppRouteShell shell={shell}>
				<div data-testid="public-page">public page</div>
			</AppRouteShell>,
		);

		expect(screen.getByTestId("app-shell")).toHaveTextContent("mount-1");
		expect(shellState.mounts).toBe(1);
	});

	it("leaves the shell for public routes", () => {
		navigation.pathname = "/";
		shellState.mounts = 0;
		const shell = <TestShell />;
		const view = render(
			<AppRouteShell shell={shell}>
				<div data-testid="public-page">public page</div>
			</AppRouteShell>,
		);

		navigation.pathname = "/register";
		view.rerender(
			<AppRouteShell shell={shell}>
				<div data-testid="public-page">public page</div>
			</AppRouteShell>,
		);

		expect(screen.getByTestId("public-page")).toBeInTheDocument();
		expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
	});
});
