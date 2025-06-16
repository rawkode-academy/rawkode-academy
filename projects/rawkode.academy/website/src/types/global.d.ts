interface Window {
	GrafanaFaroWebSdk?: {
		faro: {
			api: {
				pushError: (error: Error, context?: Record<string, any>) => void;
			};
		};
	};
}
