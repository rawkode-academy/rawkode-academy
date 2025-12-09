import { PlatformService } from '../../../generators/projen-platform-service/src/';

const project = new PlatformService({
	serviceName: 'ski-share-cards',
	servicePrefix: 'games',
	includeDataModel: false,
	includeReadModel: false,
	includeWriteModel: false,
	includeHttp: true,
	bindings: {
		r2Buckets: [{
			binding: "UGC_BUCKET",
			bucket_name: "rawkode-academy-ugc",
		}],
	},
});

project.synth();
