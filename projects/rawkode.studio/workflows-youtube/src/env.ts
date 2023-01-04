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
		address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
		namespace: process.env.TEMPORAL_NAMESPACE || "default",

		taskQueue: process.env.TEMPORAL_TASK_QUEUE || "youtube",

		useTls: process.env.TEMPORAL_USE_TLS === "true",
		clientCertPath: process.env.TEMPORAL_CLIENT_CERT_PATH,
		clientKeyPath: process.env.TEMPORAL_CLIENT_KEY_PATH,
		serverNameOverride: process.env.TEMPORAL_SERVER_NAME_OVERRIDE,
		serverRootCACertificatePath: process.env.TEMPORAL_SERVER_ROOT_CA_CERT_PATH,
	};
};
