interface Window {
	posthog?: {
		capture: (event: string, properties?: Record<string, unknown>) => void;
		identify: (distinctId: string, properties?: Record<string, unknown>) => void;
		register: (properties: Record<string, unknown>) => void;
		opt_in_capturing: () => void;
		opt_out_capturing: () => void;
	};
	enablePostHog?: () => void;
}
