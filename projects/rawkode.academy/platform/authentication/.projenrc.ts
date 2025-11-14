import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'authentication',
	databaseId: "TBD", // Will be created during deployment
	includeReadModel: false, // RPC-only service, no GraphQL
	includeWriteModel: false, // Using RPC instead of write-model
	includeRpcModel: true, // Using capnweb for RPC (manual rpc/ directory for now)
	additionalDependencies: {
		"better-auth": "^1.0.7",
		"capnweb": "^0.2.0",
	},
});

project.synth();
