import { useEffect, useState, type ComponentType } from "react";
import { useCommandPalette } from "@/hooks/useCommandPalette";

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function CommandPaletteWrapper() {
	const { isOpen, close } = useCommandPalette();
	const [hasBeenOpened, setHasBeenOpened] = useState(false);
	const [CommandPalette, setCommandPalette] =
		useState<ComponentType<CommandPaletteProps> | null>(null);

	useEffect(() => {
		if (isOpen) {
			setHasBeenOpened(true);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!hasBeenOpened || CommandPalette) return;

		let isCancelled = false;

		import("./index").then((module) => {
			if (!isCancelled) {
				setCommandPalette(() => module.default);
			}
		});

		return () => {
			isCancelled = true;
		};
	}, [CommandPalette, hasBeenOpened]);

	if (!CommandPalette) return null;

	return <CommandPalette isOpen={isOpen} onClose={close} />;
}
