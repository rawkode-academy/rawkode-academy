import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'transcription-terms',
	includeWriteModel: false,
	bindings: {
		d1Databases: [{
			binding: "DB",
			database_name: "platform-transcription-terms",
			database_id: "0466023a-da45-4b6e-8aed-d638c790be62",
		}],
	},
});

project.synth();
