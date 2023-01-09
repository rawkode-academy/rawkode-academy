interface Env {
	useTls: boolean;
	address: string;
	namespace: string;
	taskQueue: string;
	clientCertPath?: string;
	clientKeyPath?: string;
	serverNameOverride?: string;
	serverRootCACertificatePath?: string;
}

export const getEnv = (): Env => {
	return {
		address: process.env.TEMPORAL_HOST_URL || "localhost:7233",
		namespace: process.env.TEMPORAL_NAMESPACE || "default",

		taskQueue: process.env.TEMPORAL_TASK_QUEUE || "youtube",

		useTls: process.env.TEMPORAL_MTLS === "true",
		clientCertPath: process.env.TEMPORAL_MTLS_TLS_CERT,
		clientKeyPath: process.env.TEMPORAL_MTLS_TLS_KEY,
		serverNameOverride: process.env.TEMPORAL_MTLS_TLS_SERVER_NAME,
		serverRootCACertificatePath: process.env.TEMPORAL_MTLS_TLS_CA,
	};
};
