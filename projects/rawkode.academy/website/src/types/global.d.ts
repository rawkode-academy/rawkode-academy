interface Window {
	posthog?: {
		capture: (event: string, properties?: Record<string, unknown>) => void;
		identify: (distinctId: string, properties?: Record<string, unknown>) => void;
		register: (properties: Record<string, unknown>) => void;
	};
	grafanaFaro?: {
		api: {
			pushEvent: (event: string, attributes?: Record<string, unknown>) => void;
			pushError: (error: Error, context?: Record<string, unknown>) => void;
			setSession: (session: { attributes?: Record<string, unknown> }) => void;
		};
	} | null;
}
