import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'emoji-reactions',
	databaseId: "86e45a3f-6d07-48d7-9bbb-4edfacfbe1ca",
	includeWriteModel: true,
});

project.synth();
