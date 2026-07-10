"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { DEFAULT_SUBTITLE_STYLE, setSubtitlePreference, type SubtitleStyle } from "@/lib/subtitle-preferences";

const Context = createContext<{ style: SubtitleStyle; update: (change: Partial<SubtitleStyle>) => Promise<void>; error: boolean }>({ style: DEFAULT_SUBTITLE_STYLE, update: async () => undefined, error: false });

export function SubtitlePreferencesProvider({ initialStyle, children }: { initialStyle?: SubtitleStyle; children: ReactNode }) {
  const [style, setStyle] = useState(initialStyle ?? DEFAULT_SUBTITLE_STYLE);
  const [error, setError] = useState(false);
  const update = useCallback(async (change: Partial<SubtitleStyle>) => {
    const previous = style;
    const next = { ...style, ...change };
    setStyle(next); setError(false);
    try { setStyle(await setSubtitlePreference(next)); }
    catch { setStyle(previous); setError(true); }
  }, [style]);
  return <Context.Provider value={{ style, update, error }}>{children}</Context.Provider>;
}

export function useSubtitlePreferences() { return useContext(Context); }
