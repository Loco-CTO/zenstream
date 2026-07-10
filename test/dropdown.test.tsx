import { fireEvent, render, screen } from "@testing-library/react";
import { Dropdown } from "@/components/ui/dropdown";

const options = [
  { value: "one", label: "First option" },
  { value: "two", label: "Second option" },
];

describe("Dropdown", () => {
  it("opens, selects an option, and returns focus to the trigger", () => {
    const onChange = vi.fn();
    render(<Dropdown aria-label="Example" value="one" options={options} onChange={onChange} />);

    const trigger = screen.getByRole("combobox", { name: "Example" });
    expect(trigger).toHaveClass("bg-[var(--c-glass)]", "backdrop-blur-xl");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Example" })).toHaveClass("bg-black/25", "backdrop-blur-xl");

    fireEvent.click(screen.getByRole("option", { name: "Second option" }));

    expect(onChange).toHaveBeenCalledWith("two");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("supports keyboard navigation and Escape", () => {
    const onChange = vi.fn();
    render(<Dropdown aria-label="Example" value="one" options={options} onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Example" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("two");

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
