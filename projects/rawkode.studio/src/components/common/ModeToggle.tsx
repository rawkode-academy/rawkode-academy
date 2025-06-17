import { Moon, Sun } from "lucide-react";
import * as React from "react";
import { useEffect } from "react";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

export function ModeToggle() {
  const [theme, setThemeState] = React.useState<"light" | "dark" | "system">(
    "light",
  );

  useEffect(() => {
    // Get the stored theme or check if we're using system preference
    const storedTheme =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("theme")
        : null;

    if (!storedTheme) {
      // No stored preference, using system
      setThemeState("system");
    } else {
      // Use stored preference
      setThemeState(storedTheme as "light" | "dark");
    }
  }, []);

  useEffect(() => {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList[isDark ? "add" : "remove"]("dark");

    // Store the theme preference
    if (typeof localStorage !== "undefined") {
      if (theme === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", theme);
      }
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        const isDark = mediaQuery.matches;
        document.documentElement.classList[isDark ? "add" : "remove"]("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setThemeState("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeState("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeState("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
