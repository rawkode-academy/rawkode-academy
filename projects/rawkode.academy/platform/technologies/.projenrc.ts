import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'technologies',
	databaseId: "4671b796-cdc8-4a4e-aa58-4e10eb24b67d",
	includeWriteModel: false,
});

project.synth();
