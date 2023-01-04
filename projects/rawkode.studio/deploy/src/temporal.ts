import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

export class Temporal extends pulumi.CustomResource {
	constructor() {
		super("temporal:temporal:Temporal", "temporal", {}, {});

		new kubernetes.apiextensions.CustomResource("postgresql", {
			apiVersion: "postgresql.cnpg.io/v1",
			kind: "Cluster",
			metadata: {
				name: "temporal-postgresql",
			},
			spec: {
				instances: 3,
				imageName: "ghcr.io/cloudnative-pg/postgresql:13.4",
				primaryUpdateStrategy: "unsupervised",
				storage: {
					size: "10Gi",
				},
			},
		});
	}
}
