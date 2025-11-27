import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'video-likes',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-video-likes",
			database_id: "a21ba9e6-f246-4bf1-a71f-c9ef4a45733b",
		}],
	},
});

project.synth();
