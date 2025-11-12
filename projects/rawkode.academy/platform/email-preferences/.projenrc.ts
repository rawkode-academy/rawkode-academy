import { PlatformService } from "../../generators/projen-platform-service/src/";

const project = new PlatformService({
	serviceName: "email-preferences",
	databaseId: "44d635de-dd0d-4ca1-bf51-b8f4e39a9388",
	includeWriteModel: false,
});

project.synth();
