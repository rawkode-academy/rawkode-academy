import { PlatformService } from '../../../generators/projen-platform-service/src/';

const project = new PlatformService({
	serviceName: 'ski-achievements',
	servicePrefix: 'games',
	includeReadModel: false,
	includeHttp: true,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "games-ski-achievements",
			database_id: "e2bf9ae1-d84e-4b01-b3dc-5213299b9c3c",
		}],
		services: [{
			binding: "ANALYTICS",
			service: "analytics",
		}],
	},
});

project.synth();
