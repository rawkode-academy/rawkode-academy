import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'episodes',
	databaseId: "e1e6c651-f251-486f-94ce-72899f0c4dbf",
	includeWriteModel: false,
});

project.synth();
