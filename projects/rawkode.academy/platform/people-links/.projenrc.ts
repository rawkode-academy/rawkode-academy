import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'people-links',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-people-links",
			database_id: "a9fd441c-34f3-4f1d-a4c0-875d2716e694",
		}],
	},
});

project.synth();
