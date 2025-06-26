import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'people',
	databaseId: "d2cd6600-ca32-47d8-bc7d-147c6c7bb794",
	includeWriteModel: false,
});

project.synth();
