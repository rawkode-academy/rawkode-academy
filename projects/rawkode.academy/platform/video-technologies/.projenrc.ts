import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'video-technologies',
	databaseId: "fcbbfbca-d078-49a5-b9cb-edf6b17592a0",
	includeWriteModel: false,
});

project.synth();
