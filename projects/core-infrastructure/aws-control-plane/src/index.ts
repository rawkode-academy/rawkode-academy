import * as aws from "@pulumi/aws";
import { RawkodeProject, configureProject } from "./project";

const awsProvider = new aws.Provider("aws", {
	region: "eu-west-2",
});

const coreInfrastructureDns = new RawkodeProject(
	"core-infrastructure-dns",
	configureProject({
		provider: awsProvider,
		policyAttachments: [aws.iam.ManagedPolicy.AmazonRoute53FullAccess],
	}),
);

const coreInfrastructureKubernetes = new RawkodeProject(
	"core-infrastructure-kubernetes",
	configureProject({
		provider: awsProvider,
	}),
);

const coreInfrastructure1Password = new RawkodeProject(
	"core-infrastructure-1password",
	configureProject({
		provider: awsProvider,
	}),
);

const coreInfrastructureTeleport = new RawkodeProject(
	"core-infrastructure-teleport",
	configureProject({
		provider: awsProvider,
	}),
);

const rawkodeAcademy = new RawkodeProject(
	"rawkode-academy",
	configureProject({
		provider: awsProvider,
	}),
);

const rawkodeStudio = new RawkodeProject(
	"rawkode-studio",
	configureProject({
		provider: awsProvider,
	}),
);
