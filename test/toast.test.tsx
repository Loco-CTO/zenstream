import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n";

function Triggers() {
	const toast = useToast();
	return (
		<>
			<button onClick={() => toast.success("Joined the group")}>Success</button>
			<button onClick={() => toast.error("Could not join")}>Error</button>
		</>
	);
}

describe("ToastProvider", () => {
	afterEach(() => vi.useRealTimers());
	it("stacks accessible toasts that can be dismissed or expire", () => {
		vi.useFakeTimers();
		render(
			<I18nProvider locale="en">
				<ToastProvider>
					<Triggers />
				</ToastProvider>
			</I18nProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Success" }));
		fireEvent.click(screen.getByRole("button", { name: "Error" }));
		expect(screen.getByRole("status")).toHaveTextContent("Joined the group");
		expect(screen.getByRole("alert")).toHaveTextContent("Could not join");
		expect(screen.getByRole("status").parentElement).toHaveClass("z-[400]");
		fireEvent.click(
			screen.getAllByRole("button", { name: "Dismiss notification" })[0],
		);
		expect(screen.queryByText("Joined the group")).not.toBeInTheDocument();
		act(() => vi.advanceTimersByTime(5_000));
		expect(screen.queryByText("Could not join")).not.toBeInTheDocument();
	});
});
