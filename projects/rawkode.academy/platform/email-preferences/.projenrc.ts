import { PlatformService } from "../../generators/projen-platform-service/src/";

const project = new PlatformService({
	serviceName: "email-preferences",
	includeWriteModel: false,
	includeRpc: true,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-email-preferences",
			database_id: "d1e7b151-f20f-4470-8c84-266fcb76e84f",
		}],
	},
});

project.synth();
