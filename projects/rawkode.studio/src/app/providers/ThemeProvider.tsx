import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	resolvedTheme: ResolvedTheme | undefined;
	systemTheme: ResolvedTheme | undefined;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "theme";
const MEDIA = "(prefers-color-scheme: dark)";

// Get the system theme preference
const getSystemTheme = (): ResolvedTheme => {
	if (typeof window !== "undefined" && window.matchMedia(MEDIA).matches) {
		return "dark";
	}
	return "light";
};

// Get the theme from storage or default to system
const getTheme = (): Theme => {
	if (typeof window === "undefined") return "system";

	try {
		const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
		return stored || "system";
	} catch {
		return "system";
	}
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(getTheme);
	const [systemTheme, setSystemTheme] = useState<ResolvedTheme | undefined>();
	const [mounted, setMounted] = useState(false);

	// Calculate resolved theme
	const resolvedTheme = useMemo<ResolvedTheme | undefined>(() => {
		if (!mounted) return undefined;

		if (theme === "system") {
			return systemTheme;
		}

		return theme as ResolvedTheme;
	}, [theme, systemTheme, mounted]);

	// Apply theme to DOM
	useEffect(() => {
		const root = window.document.documentElement;

		if (resolvedTheme) {
			root.classList.remove("light", "dark");
			root.classList.add(resolvedTheme);
			root.style.colorScheme = resolvedTheme;
		}
	}, [resolvedTheme]);

	// Handle system theme changes
	useEffect(() => {
		setMounted(true);
		setSystemTheme(getSystemTheme());

		const mediaQuery = window.matchMedia(MEDIA);

		const handleChange = () => {
			setSystemTheme(getSystemTheme());
		};

		// Modern browsers
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", handleChange);
		} else {
			// Fallback for older browsers
			mediaQuery.addListener(handleChange);
		}

		return () => {
			if (mediaQuery.removeEventListener) {
				mediaQuery.removeEventListener("change", handleChange);
			} else {
				mediaQuery.removeListener(handleChange);
			}
		};
	}, []);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);

		try {
			localStorage.setItem(STORAGE_KEY, newTheme);
		} catch {
			// Ignore errors (e.g., in private mode)
		}
	};

	const value = useMemo(
		() => ({
			theme,
			setTheme,
			resolvedTheme,
			systemTheme,
		}),
		[theme, resolvedTheme, systemTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
