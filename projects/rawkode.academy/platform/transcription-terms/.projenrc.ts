import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'transcription-terms',
	databaseId: "0466023a-da45-4b6e-8aed-d638c790be62",
	includeWriteModel: false,
});

project.synth();
