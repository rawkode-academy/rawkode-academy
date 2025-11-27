import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'people-biographies',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-people-biographies",
			database_id: "6ae3c7be-86f1-4385-9d07-629969b0f950",
		}],
	},
});

project.synth();
