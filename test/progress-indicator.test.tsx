import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressProvider, useProgress } from "@/components/status/progress-indicator";

function Controls() {
  const { start } = useProgress();

  return <button onClick={() => start()}>Start</button>;
}

describe("ProgressProvider", () => {
  it("shows the shared progress bar while a task is active", () => {
    render(
      <ProgressProvider>
        <Controls />
      </ProgressProvider>,
    );

    const progress = screen.getByRole("progressbar", { name: "Loading" });
    expect(progress).toHaveAttribute("aria-valuetext", "Idle");

    act(() => screen.getByRole("button", { name: "Start" }).click());

    expect(progress).toHaveAttribute("aria-valuetext", "Loading");
    expect(progress).toHaveClass("opacity-100");
  });
});
