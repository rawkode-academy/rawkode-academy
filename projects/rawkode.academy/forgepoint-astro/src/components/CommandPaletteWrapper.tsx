import React, { useState, useEffect } from "react";
import { CommandPalette } from "./CommandPalette";

export function CommandPaletteWrapper() {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const handleToggle = (e: CustomEvent) => {
			setIsOpen(e.detail);
		};

		window.addEventListener(
			"toggle-command-palette",
			handleToggle as EventListener,
		);

		return () => {
			window.removeEventListener(
				"toggle-command-palette",
				handleToggle as EventListener,
			);
		};
	}, []);

	return <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
