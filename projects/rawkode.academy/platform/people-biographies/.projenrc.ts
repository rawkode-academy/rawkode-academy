import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'people-biographies',
	databaseId: "6ae3c7be-86f1-4385-9d07-629969b0f950",
	includeWriteModel: false,
});

project.synth();
