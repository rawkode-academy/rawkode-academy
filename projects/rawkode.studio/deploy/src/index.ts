import * as kubernetes from "@pulumi/kubernetes";

const redpandaCluster = new kubernetes.helm.v3.Chart("redpanda", {
	fetchOpts: {
		repo: "https://charts.redpanda.com/",
	},
	chart: "redpanda",
	version: "2.4.0",
	namespace: "studio",
	skipAwait: true,
	values: {
		tls: {
			enabled: true,
		},
		external: {
			enabled: false,
		},
	},
});

const redpandaConsole = new kubernetes.helm.v3.Chart("redpanda-console", {
	fetchOpts: {
		repo: "https://charts.redpanda.com/",
	},
	chart: "console",
	version: "2.4.0",
	skipAwait: true,
	values: {
		console: {
			config: {
				kafka: {
					clientId: "console",
					brokers: ["redpanda:9092"],
					tls: {
						enabled: true,
					},
				},
			},
		},
	},
});
