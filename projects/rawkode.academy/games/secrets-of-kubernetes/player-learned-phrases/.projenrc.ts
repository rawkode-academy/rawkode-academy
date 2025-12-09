import { PlatformService } from '../../../generators/projen-platform-service/src/';

const project = new PlatformService({
	serviceName: 'ski-player-learned-phrases',
	servicePrefix: 'games',
	includeReadModel: false,
	includeHttp: true,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "games-ski-player-learned-phrases",
			database_id: "19c4aaee-cf4b-4d42-8e4b-41219b780590",
		}],
	},
});

project.synth();
