"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

export function ThemeToggle() {
  const { theme, toggleTheme } = useUiStore();
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
