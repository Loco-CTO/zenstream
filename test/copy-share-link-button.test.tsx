import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyShareLinkButton } from "@/components/ui/copy-share-link-button";
import { I18nProvider } from "@/lib/i18n";

describe("CopyShareLinkButton", () => {
	const clipboardDescriptor = Object.getOwnPropertyDescriptor(
		navigator,
		"clipboard",
	);

	afterEach(() => {
		cleanup();
		if (clipboardDescriptor) {
			Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
		} else {
			Reflect.deleteProperty(navigator, "clipboard");
		}
	});

	it("copies the current detail route and query without its fragment", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		window.history.replaceState(
			null,
			"",
			"/album/album-1?trackId=track-1#selected-track",
		);

		renderButton();
		fireEvent.click(screen.getByRole("button", { name: "Copy share link" }));

		await waitFor(() =>
			expect(writeText).toHaveBeenCalledWith(
				`${window.location.origin}/album/album-1?trackId=track-1`,
			),
		);
		expect(
			screen.getByRole("button", { name: "Link copied" }),
		).toBeInTheDocument();
	});

	it("shows an accessible error when the clipboard rejects the copy", async () => {
		const writeText = vi.fn().mockRejectedValue(new Error("clipboard blocked"));
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		renderButton();
		fireEvent.click(screen.getByRole("button", { name: "Copy share link" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Could not copy the link",
		);
	});
});

function renderButton() {
	return render(
		<I18nProvider locale="en">
			<CopyShareLinkButton />
		</I18nProvider>,
	);
}
