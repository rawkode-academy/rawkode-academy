import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CommandPalette from "./index";

/**
 * Self-managing host for the command palette. The palette (and React
 * itself) only load when this module is dynamically imported by the
 * topbar's vanilla trigger script, so no React ships on the common
 * path. Once mounted, the host owns the keyboard shortcut and the
 * `open-command-palette` event.
 */
function CommandPaletteHost() {
	const [isOpen, setIsOpen] = useState(true);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "/")) {
				e.preventDefault();
				setIsOpen((prev) => !prev);
			}
		};
		const handleOpenRequest = () => setIsOpen(true);

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("open-command-palette", handleOpenRequest);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("open-command-palette", handleOpenRequest);
		};
	}, []);

	return <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}

let mounted = false;

export function mountCommandPalette() {
	if (mounted) {
		document.dispatchEvent(new CustomEvent("open-command-palette"));
		return;
	}
	mounted = true;
	const container = document.createElement("div");
	container.id = "command-palette-root";
	document.body.appendChild(container);
	createRoot(container).render(<CommandPaletteHost />);
}
