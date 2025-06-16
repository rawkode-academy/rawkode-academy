import { useEffect, useState } from "react";

interface CommandPaletteHook {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
}

export function useCommandPalette(): CommandPaletteHook {
	const [isOpen, setIsOpen] = useState(false);

	const open = (): void => setIsOpen(true);
	const close = (): void => setIsOpen(false);
	const toggle = (): void => setIsOpen((prev) => !prev);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Cmd+K on Mac, Ctrl+K on Windows/Linux
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				toggle();
			}

			// Cmd+/ on Mac, Ctrl+/ on Windows/Linux (alternative shortcut)
			if ((e.metaKey || e.ctrlKey) && e.key === "/") {
				e.preventDefault();
				toggle();
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	return {
		isOpen,
		open,
		close,
		toggle,
	};
}
