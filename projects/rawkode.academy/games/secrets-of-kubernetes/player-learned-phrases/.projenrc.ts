import { PlatformService } from '../../../generators/projen-platform-service/src/';

const project = new PlatformService({
	serviceName: 'ski-player-learned-phrases',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "ski-player-learned-phrases",
			database_id: "REPLACE_WITH_D1_DATABASE_ID",
		}],
	},
});

project.synth();
