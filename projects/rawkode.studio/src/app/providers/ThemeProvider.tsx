import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	actualTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
	children: ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "rawkode-studio-theme",
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(defaultTheme);
	const [actualTheme, setActualTheme] = useState<"light" | "dark">("dark");

	useEffect(() => {
		// Load theme from localStorage on mount
		const storedTheme = localStorage.getItem(storageKey) as Theme;
		if (storedTheme) {
			setThemeState(storedTheme);
		}
	}, [storageKey]);

	useEffect(() => {
		// Update actual theme based on theme setting and system preference
		const updateActualTheme = () => {
			let newActualTheme: "light" | "dark";

			if (theme === "system") {
				newActualTheme = window.matchMedia("(prefers-color-scheme: dark)")
					.matches
					? "dark"
					: "light";
			} else {
				newActualTheme = theme;
			}

			setActualTheme(newActualTheme);

			// Update document class and CSS variables
			const root = document.documentElement;
			root.classList.remove("light", "dark");
			root.classList.add(newActualTheme);

			// Update meta theme-color
			const metaThemeColor = document.querySelector('meta[name="theme-color"]');
			if (metaThemeColor) {
				metaThemeColor.setAttribute(
					"content",
					newActualTheme === "dark" ? "#0f172a" : "#ffffff",
				);
			}
		};

		updateActualTheme();

		// Listen for system theme changes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			if (theme === "system") {
				updateActualTheme();
			}
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		localStorage.setItem(storageKey, newTheme);
	};

	const value: ThemeContextType = {
		theme,
		setTheme,
		actualTheme,
	};

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
