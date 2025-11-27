import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'video-technologies',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-video-technologies",
			database_id: "fcbbfbca-d078-49a5-b9cb-edf6b17592a0",
		}],
	},
});

project.synth();
