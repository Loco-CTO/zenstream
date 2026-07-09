import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("font configuration", () => {
  it("loads and applies Noto Sans globally", () => {
    const layout = readFileSync(join(root, "app", "layout.tsx"), "utf8");
    const globals = readFileSync(join(root, "app", "globals.css"), "utf8");

    expect(layout).toContain('import { Noto_Sans } from "next/font/google";');
    expect(layout).toContain('variable: "--font-noto-sans"');
    expect(layout).toContain("notoSans.variable");
    expect(globals).toContain("--font-sans: var(--font-noto-sans);");
    expect(globals).toContain("font-family: var(--font-noto-sans)");
  });

  it("keeps the UI type scale at least 12px", () => {
    const files = [
      "app/globals.css",
      "components/layout/mobile-nav.tsx",
      "components/layout/navbar.tsx",
      "components/layout/search-overlay.tsx",
      "components/pages/login-page.tsx",
      "components/pages/home-page.tsx",
      "components/status/error-panel.tsx",
      "components/status/progress-indicator.tsx",
      "components/home/hero.tsx",
      "components/home/media-row.tsx",
      "components/home/media-card.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/);
      expect(source, file).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/);
    }
  });
});
