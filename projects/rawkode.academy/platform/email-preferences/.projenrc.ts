import { PlatformService } from "../../generators/projen-platform-service/src/";

const project = new PlatformService({
	serviceName: "email-preferences",
	databaseId: "d1e7b151-f20f-4470-8c84-266fcb76e84f",
	includeWriteModel: false,
	includeRpcModel: true,
});

project.synth();
