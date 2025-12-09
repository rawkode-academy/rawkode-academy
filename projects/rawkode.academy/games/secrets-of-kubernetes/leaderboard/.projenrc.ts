import { PlatformService } from '../../../generators/projen-platform-service/src/';

const project = new PlatformService({
	serviceName: 'ski-leaderboard',
	servicePrefix: 'games',
	includeReadModel: false,
	includeHttp: true,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "games-ski-leaderboard",
			database_id: "757791da-d31e-476a-a6ab-669ed19d38eb",
		}],
	},
});

project.synth();
