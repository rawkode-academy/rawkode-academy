import { PlatformService } from '../../generators/projen-platform-service/src/';


const project = new PlatformService({
  serviceName: 'casting-credits',
	databaseId: "15730bdf-5b13-40dd-b072-0d15ee0a570a",
	includeWriteModel: true,
});

project.synth();
