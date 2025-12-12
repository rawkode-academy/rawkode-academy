import { PlatformService } from "../../../generators/projen-platform-service/src/";

const project = new PlatformService({
	serviceName: "gtl-leaderboard",
	servicePrefix: "games",
	includeReadModel: false,
	includeHttp: true,
	bindings: {
		d1Databases: [
			{
				binding: "DB",
				database_name: "games-gtl-leaderboard",
				database_id: "00000000-0000-0000-0000-000000000000",
			},
		],
	},
});

project.synth();
