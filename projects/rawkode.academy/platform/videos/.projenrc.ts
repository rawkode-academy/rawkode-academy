import { PlatformService } from '../../generators/projen-platform-service/src';

const project = new PlatformService({
  serviceName: 'videos',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-videos",
			database_id: "0e96020b-eb03-456c-a593-fa73f2e845d4",
		}],
	},
});

project.synth();

