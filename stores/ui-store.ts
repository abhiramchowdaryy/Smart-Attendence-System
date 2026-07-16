"use client";

import { create } from "zustand";

interface UiState {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: "light",
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
        try {
          localStorage.setItem("pes-theme", next);
        } catch {}
      }
      return { theme: next };
    }),
}));
