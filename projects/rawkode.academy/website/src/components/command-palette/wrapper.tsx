import CommandPalette from "./index";
import { useCommandPalette } from "@/hooks/useCommandPalette";

export default function CommandPaletteWrapper() {
	const { isOpen, close } = useCommandPalette();

	return <CommandPalette isOpen={isOpen} onClose={close} />;
}
