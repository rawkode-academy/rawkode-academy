import { PlatformService } from '../../generators/projen-platform-service/src';

const project = new PlatformService({
  serviceName: 'videos',
	databaseId: "0e96020b-eb03-456c-a593-fa73f2e845d4",
	includeWriteModel: false,
	includeTests: false,
});

project.synth();

