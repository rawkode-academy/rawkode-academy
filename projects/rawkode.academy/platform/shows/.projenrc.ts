import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'shows',
	databaseId: "533025e2-2267-41e8-bf38-ad171a0d9de4",
	includeWriteModel: true,
});

project.synth();
