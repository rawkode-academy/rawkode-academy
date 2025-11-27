import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'people',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-people",
			database_id: "d2cd6600-ca32-47d8-bc7d-147c6c7bb794",
		}],
	},
});

project.synth();
