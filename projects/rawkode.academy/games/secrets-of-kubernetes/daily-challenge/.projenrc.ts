import { PlatformService } from '../../../generators/projen-platform-service/src/';

const project = new PlatformService({
	serviceName: 'ski-daily-challenge',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "ski-daily-challenge",
			database_id: "REPLACE_WITH_D1_DATABASE_ID",
		}],
	},
});

project.synth();
