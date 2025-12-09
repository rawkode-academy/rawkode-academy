import { PlatformService } from '../../../generators/projen-platform-service/src/';

const project = new PlatformService({
	serviceName: 'ski-player-stats',
	servicePrefix: 'games',
	includeReadModel: false,
	includeHttp: true,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "games-ski-player-stats",
			database_id: "accba40f-4eae-4cbc-866d-8e28062edafe",
		}],
	},
});

project.synth();
