import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";

describe("HorizontalScroller", () => {
  it("allows touch gestures to pan vertically so the page can scroll", () => {
    render(
      <HorizontalScroller title="Popular">
        <div>Movie</div>
      </HorizontalScroller>,
    );

    expect(screen.getByLabelText("Popular")).toHaveClass("touch-pan-x", "touch-pan-y");
  });
});
