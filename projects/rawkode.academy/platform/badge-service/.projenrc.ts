import { PlatformService } from "../../generators/projen-platform-service/src/";

const project = new PlatformService({
	serviceName: "badge-service",
	includeDataModel: true,
	includeReadModel: false,
	includeWriteModel: false,
	includeHttp: true,
	bindings: {
		d1Databases: [
			{
				binding: "DB",
				database_name: "platform-badge",
				database_id: "", // Will be filled after creating D1 database
				migrations_dir: "../data-model/migrations",
			},
		],
		services: [
			{
				binding: "IDENTITY",
				service: "identity",
			},
		],
	},
	additionalDependencies: {
		cloudevents: "^10.0.0",
		jose: "catalog:auth",
		utf64: "^1.0.0",
	},
	additionalScripts: {
		"generate-keys": "bun run scripts/generate-rsa-keys.ts",
	},
});

project.synth();
