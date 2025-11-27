import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'episodes',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-episodes",
			database_id: "e1e6c651-f251-486f-94ce-72899f0c4dbf",
		}],
	},
});

project.synth();
