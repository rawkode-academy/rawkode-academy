import { useCommandPalette } from "@/hooks/useCommandPalette";
import CommandPalette from "./index";

export default function CommandPaletteWrapper() {
	const { isOpen, close } = useCommandPalette();

	return <CommandPalette isOpen={isOpen} onClose={close} />;
}
