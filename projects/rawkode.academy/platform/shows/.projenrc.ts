import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'shows',
	includeWriteModel: true,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-shows",
			database_id: "533025e2-2267-41e8-bf38-ad171a0d9de4",
		}],
	},
});

project.synth();
