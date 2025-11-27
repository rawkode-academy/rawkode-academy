import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'show-hosts',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-show-hosts",
			database_id: "e5252389-4324-4745-a70d-d18e0f03ccff",
		}],
	},
});

project.synth();
