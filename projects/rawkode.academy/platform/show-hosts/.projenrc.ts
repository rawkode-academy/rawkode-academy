import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'show-hosts',
	databaseId: "e5252389-4324-4745-a70d-d18e0f03ccff",
	includeWriteModel: false,
});

project.synth();
