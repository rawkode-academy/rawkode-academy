import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'video-likes',
	databaseId: "a21ba9e6-f246-4bf1-a71f-c9ef4a45733b",
	includeWriteModel: false,
});

project.synth();
