import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'emoji-reactions',
	includeWriteModel: true,
	additionalDependencies: {
		'better-auth': '^1.4.3',
		cloudevents: '^8.0.2',
	},
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-emoji-reactions",
			database_id: "86e45a3f-6d07-48d7-9bbb-4edfacfbe1ca",
		}],
		workflows: [{
			binding: "reactToContent",
			name: "react-to-content",
			class_name: "ReactToContentWorkflow",
		}],
	},
});

project.synth();
