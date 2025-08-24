import { type ReactElement, useEffect, useRef } from "react";
import { type Component, createApp, h } from "vue";

interface VueInReactProps {
	component: Component;
	props?: Record<string, unknown>;
}

export const VueInReact = ({
	component,
	props = {},
}: VueInReactProps): ReactElement => {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const app = createApp({
			render() {
				return h(component, props);
			},
		});

		app.mount(containerRef.current);

		return () => {
			app.unmount();
		};
	}, [component, JSON.stringify(props)]);

	return <div ref={containerRef} />;
};
