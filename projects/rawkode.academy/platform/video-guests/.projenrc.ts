import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'video-guests',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-video-guests",
			database_id: "97e8a081-fec7-42fe-bf2f-9d7527654bff",
		}],
	},
});

project.synth();
