import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'people-links',
	databaseId: "a9fd441c-34f3-4f1d-a4c0-875d2716e694",
	includeWriteModel: false,
});

project.synth();
