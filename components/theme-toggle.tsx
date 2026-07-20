"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

export function ThemeToggle() {
  // Atomic selectors: destructuring the store object subscribes this
  // component to every field, so any future slice added to the UI store
  // would start re-rendering the header on each change.
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const [mounted, setMounted] = useState(false);

  // Sync store with the class the head script applied before hydration
  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark !== (theme === "dark")) {
      useUiStore.setState({ theme: isDark ? "dark" : "light" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return <div className="size-11" aria-hidden="true" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
