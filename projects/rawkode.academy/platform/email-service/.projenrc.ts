import { PlatformService } from "../../generators/projen-platform-service/src/";

const project = new PlatformService({
	serviceName: "email-service",
	includeDataModel: false,
	includeReadModel: false,
	includeWriteModel: false,
	includeRpcModel: true,
	bindings: {
		sendEmail: [{
			name: "SEND_EMAIL",
		}],
		services: [{
			binding: "EMAIL_PREFERENCES",
			service: "platform-email-preferences-rpc",
		}],
	},
});

project.synth();
