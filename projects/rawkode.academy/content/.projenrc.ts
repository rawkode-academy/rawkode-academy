import { PlatformService } from "../generators/projen-platform-service/src";

const project = new PlatformService({
	serviceName: "content",
	includeDataModel: false,
	includeReadModel: false,
	includeWriteModel: false,
	includeHttp: true,
	bindings: {
		r2Buckets: [
			{ binding: "CONTENT_BUCKET", bucket_name: "rawkode-academy-content" },
		],
		routes: [
			{ pattern: "content.rawkode.academy", custom_domain: true },
		],
	},
});

project.synth();
