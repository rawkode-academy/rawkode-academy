import { useEffect, useRef } from "react";
import { createApp, h } from "vue";

interface VueInReactProps {
	component: any;
	props?: Record<string, any>;
}

export const VueInReact = ({ component, props = {} }: VueInReactProps) => {
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
