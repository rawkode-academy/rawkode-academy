import * as kubernetes from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

//
new kubernetes.kustomize.Directory("chappaai", {
	directory: "https://github.com/rawkode/chappaai/tree/main/deploy",
});

const oauthApiYouTube = new kubernetes.apiextensions.CustomResource(
	"youtube-oauth-api",
	{
		kind: "OAuthApi",
		apiVersion: "chappaai.dev/v1",
		metadata: {
			name: "youtube",
		},
		spec: {
			http: {
				baseUrl: "https://www.googleapis.com/youtube/v3",
				authorizationHeaderPrefix: "Bearer",
				headers: [
					{
						key: "Accept",
						value: "application/json",
					},
					{
						key: "User-Agent",
						value: "chappaai",
					},
				],
			},
			auth: {
				oAuth2: {
					authorizationUrl: "",
					tokenUrl: "",
					authorizationParams: [
						{
							key: "prompt",
							value: "consent",
						},
						{
							key: "access_type",
							value: "offline",
						},
						{
							key: "response_type",
							value: "code",
						},
					],
					tokenParams: {
						grantType: "authorization_code",
					},
				},
			},
		},
	},
);

new kubernetes.apiextensions.CustomResource("youtube-oauth-connection", {
	kind: "OAuthConnection",
	apiVersion: "chappaai.dev/v1",
	metadata: {
		name: "youtube",
	},
	spec: {
		api: oauthApiYouTube.metadata.name,
		scopes: ["https://www.googleapis.com/auth/youtube"],
		credentials: {
			secretRef: {
				name: "youtube-oauth-credentials",
				idKey: "clientId",
				secretKey: "clientSecret",
			},
		},
	},
});

const postgreSQLClusterName = "temporal-postgresql";
const postgreSQLUsername = "postgres";

const postgreSQLPassword = new random.RandomPassword("postgresql-password", {
	length: 32,
});

const secret = new kubernetes.core.v1.Secret("postgresql-temporal", {
	type: "kubernetes.io/basic-auth",
	data: {
		username: Buffer.from(postgreSQLUsername).toString("base64"),
		password: postgreSQLPassword.result.apply((password) =>
			Buffer.from(password).toString("base64"),
		),
	},
});

new kubernetes.apiextensions.CustomResource("postgresql", {
	apiVersion: "postgresql.cnpg.io/v1",
	kind: "Cluster",
	metadata: {
		name: postgreSQLClusterName,
	},
	spec: {
		instances: 3,
		imageName: "ghcr.io/cloudnative-pg/postgresql:15",
		primaryUpdateStrategy: "unsupervised",
		enableSuperuserAccess: true,
		superuserSecret: {
			name: secret.metadata.name,
		},
		storage: {
			size: "10Gi",
		},
	},
});

new kubernetes.apiextensions.CustomResource("temporal-cluster", {
	apiVersion: "temporal.io/v1beta1",
	kind: "TemporalCluster",
	metadata: {
		// We call this temporalio to avoid conflicts during the UI config rendering.
		// The temporalio/ui container uses `TEMPORAL_UI_PORT` to configure the listening
		// port, which causes a collision with any service called temporal-ui.
		// Let's avoid that
		name: "temporalio",
	},
	spec: {
		version: "1.18.5",
		numHistoryShards: 1,
		jobTtlSecondsAfterFinished: 300,
		persistence: {
			defaultStore: {
				sql: {
					user: postgreSQLUsername,
					databaseName: postgreSQLUsername,
					pluginName: "postgres",
					connectAddr: `${postgreSQLClusterName}-rw:5432`,
					connectProtocol: "tcp",
				},
				passwordSecretRef: {
					name: secret.metadata.name,
					key: "password",
				},
			},
			visibilityStore: {
				sql: {
					user: postgreSQLUsername,
					databaseName: `${postgreSQLUsername}_visibility`,
					pluginName: "postgres",
					connectAddr: `${postgreSQLClusterName}-rw:5432`,
					connectProtocol: "tcp",
				},
				passwordSecretRef: {
					name: secret.metadata.name,
					key: "password",
				},
			},
		},
		mTLS: {
			provider: "cert-manager",
			internode: {
				enabled: true,
			},
			frontend: {
				enabled: true,
			},
			certificatesDuration: {
				rootCACertificate: "2h",
				intermediateCAsCertificates: "1h30m",
				clientCertificates: "1h",
				frontendCertificate: "1h",
				internodeCertificate: "1h",
			},
			refreshInterval: "5m",
		},
		ui: {
			enabled: true,
		},
		admintools: {
			enabled: true,
		},
		metrics: {
			enabled: true,
			prometheusConfig: {
				listenPort: 9090,
			},
		},
	},
});
