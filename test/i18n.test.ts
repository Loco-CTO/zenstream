import { describe, expect, it } from "vitest";
import en from "@/locale/en.yaml";
import ja from "@/locale/ja.yaml";
import { isLocale, TRANSLATION_KEYS, translate } from "@/lib/i18n";

describe("i18n", () => {
  it("translates English and Japanese interface text", () => {
    expect(translate("en", "settings")).toBe("Settings");
    expect(translate("ja", "settings")).toBe("設定");
    expect(translate("ja", "minutes", { count: 24 })).toBe("24分");
  });

  it("only accepts supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("keeps every YAML language dictionary aligned", () => {
    expect(Object.keys(en).sort()).toEqual([...TRANSLATION_KEYS].sort());
    expect(Object.keys(ja).sort()).toEqual([...TRANSLATION_KEYS].sort());
  });
});
