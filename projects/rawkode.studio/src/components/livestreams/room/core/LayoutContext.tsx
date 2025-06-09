import { LayoutType } from "@/components/livestreams/room/layouts/permissions";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useState,
} from "react";

interface LayoutContextValue {
	currentLayout: LayoutType;
	setCurrentLayout: (layout: LayoutType) => void;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
	const [currentLayout, setCurrentLayout] = useState<LayoutType>(
		LayoutType.GRID,
	);

	const handleSetLayout = useCallback((layout: LayoutType) => {
		setCurrentLayout(layout);
	}, []);

	return (
		<LayoutContext.Provider
			value={{ currentLayout, setCurrentLayout: handleSetLayout }}
		>
			{children}
		</LayoutContext.Provider>
	);
}

export function useLayout() {
	const context = useContext(LayoutContext);
	if (!context) {
		throw new Error("useLayout must be used within a LayoutProvider");
	}
	return context;
}
