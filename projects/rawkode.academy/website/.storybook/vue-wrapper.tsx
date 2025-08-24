import React, { useEffect, useRef } from "react";
import { createApp } from "vue";

export function VueWrapper({
	component,
	props = {},
}: {
	component: any;
	props?: any;
}) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const app = createApp(component, props);
		app.mount(containerRef.current);

		return () => {
			app.unmount();
		};
	}, [component, props]);

	return <div ref={containerRef} />;
}
