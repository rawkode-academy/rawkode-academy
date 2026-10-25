import { useCallback, useEffect, useRef, useState } from "react";

/** The value, once it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 250): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

/**
 * Asks before leaving the page while `dirty` is true. Returns `navigate`,
 * which leaves without asking (after a save or delete): it bypasses the
 * listener synchronously, before React could re-render to remove it.
 */
export function useUnsavedWarning(dirty: boolean): (href: string) => void {
	const bypass = useRef(false);
	useEffect(() => {
		if (!dirty) return;
		// preventDefault() is the standard; returning a string covers older Safari.
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (bypass.current) return;
			event.preventDefault();
			return "";
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [dirty]);
	return useCallback((href: string) => {
		bypass.current = true;
		window.location.assign(href);
	}, []);
}
