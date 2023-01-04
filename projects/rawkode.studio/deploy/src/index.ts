import * as kubernetes from "@pulumi/kubernetes";

new kubernetes.apiextensions.CustomResource("postgresql", {
	apiVersion: "postgresql.cnpg.io/v1",
	kind: "Cluster",
	metadata: {
		name: "temporal-postgresql",
	},
	spec: {
		instances: 3,
		imageName: "ghcr.io/cloudnative-pg/postgresql:15",
		primaryUpdateStrategy: "unsupervised",
		storage: {
			size: "10Gi",
		},
	},
});
