import React from "react";
import { createApp } from "vue";

export const VueWrapper = ({
	component,
	props,
}: { component: any; props?: any }) => {
	const ref = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (ref.current) {
			const app = createApp(component, props);
			app.mount(ref.current);

			return () => {
				app.unmount();
			};
		}
	}, [component, props]);

	return <div ref={ref} />;
};
