"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const triggerClassName = "flex min-w-32 items-center justify-between gap-3 rounded-lg border border-[var(--c-glass-border)] bg-[var(--c-glass)] px-3 py-2 text-left text-xs text-white/75 shadow-lg shadow-black/20 outline-none backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[.08] focus-visible:border-white/35 focus-visible:ring-2 focus-visible:ring-white/10";
const panelClassName = "fixed z-[100] max-h-64 overflow-y-auto rounded-lg border border-[var(--c-glass-border)] bg-[var(--c-glass-deep)] p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl";

type DropdownProps = {
  "aria-label": string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
};

export function Dropdown({ value, options, onChange, className = "", ...props }: DropdownProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => selectedIndex(options, value));
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const positionMenu = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuStyle({
        left: rect.left,
        top: rect.bottom + 6,
        minWidth: Math.max(rect.width, 144),
      });
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !document.getElementById(listboxId)?.contains(target)) {
        setOpen(false);
      }
    };

    positionMenu();
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [listboxId, open]);

  function moveActive(direction: 1 | -1) {
    if (!options.length) return;
    let next = activeIndex;
    do {
      next = (next + direction + options.length) % options.length;
    } while (options[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  }

  function choose(option: DropdownOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function toggleMenu() {
    setOpen((current) => {
      if (!current) setActiveIndex(selectedIndex(options, value));
      return !current;
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex(options, value));
        setOpen(true);
      }
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[activeIndex]) choose(options[activeIndex]);
      else {
        setActiveIndex(selectedIndex(options, value));
        setOpen(true);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={props["aria-label"]}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
        onClick={toggleMenu}
        onKeyDown={handleKeyDown}
        className={`${triggerClassName} ${className}`}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/35 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && menuStyle && createPortal(
        <div
          id={listboxId}
          role="listbox"
          aria-label={props["aria-label"]}
          style={menuStyle}
          className={panelClassName}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onPointerMove={() => !option.disabled && setActiveIndex(index)}
              onClick={() => choose(option)}
              className={`flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-xs transition ${
                index === activeIndex ? "bg-white/[.08] text-white" : "text-white/65 hover:bg-white/[.06] hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-35`}
            >
              <span>{option.label}</span>
              {option.value === value && <Check className="h-3.5 w-3.5 text-white/70" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function selectedIndex(options: DropdownOption[], value: string) {
  const index = options.findIndex((option) => option.value === value && !option.disabled);
  return index >= 0 ? index : options.findIndex((option) => !option.disabled);
}
