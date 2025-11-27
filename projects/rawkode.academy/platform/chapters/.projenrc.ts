import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'chapters',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-chapters",
			database_id: "c388193d-ef24-4016-827b-ab57a887ee4e",
		}],
	},
});

project.synth();
