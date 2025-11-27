import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'casting-credits',
	includeWriteModel: true,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-casting-credits",
			database_id: "15730bdf-5b13-40dd-b072-0d15ee0a570a",
		}],
	},
});

project.synth();
