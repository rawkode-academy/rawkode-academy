import { PlatformService } from "../../generators/projen-platform-service/src/";

const project = new PlatformService({
	serviceName: "email-preferences",
	includeWriteModel: false,
	includeHttp: true,
	additionalDependencies: {
		cloudevents: "^8.0.2",
	},
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-email-preferences",
			database_id: "68560d7f-2136-4cf5-9192-aa6d730df300",
		}],
	},
});

project.synth();
