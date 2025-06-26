import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'chapters',
	databaseId: "c388193d-ef24-4016-827b-ab57a887ee4e",
	includeWriteModel: false,
});

project.synth();
