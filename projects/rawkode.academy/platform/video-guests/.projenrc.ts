import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'video-guests',
	databaseId: "97e8a081-fec7-42fe-bf2f-9d7527654bff",
	includeWriteModel: false,
});

project.synth();
