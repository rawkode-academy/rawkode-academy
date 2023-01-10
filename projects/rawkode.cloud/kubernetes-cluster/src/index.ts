import { secret } from "@pulumi/pulumi";
import { Infrastructure } from "./infrastructure";
import { Platform } from "./platform";
import { strict } from "assert";

const requireEnvironmentVariable = (name: string): string => {
	const value = process.env[name];
	strict.ok(value, `The "${name}" environment variable is required`);

	return value;
};

const infrastructure = new Infrastructure();

const platform = new Platform("platform", {
	provider: infrastructure.kubernetesProvider,
});

import {
	CertManager,
	Chappaai,
	CloudNativePG,
	ExternalSecrets,
	FluxCD,
	PulumiOperator,
	Teleport,
	TemporalOperator,
} from "./platform/components";

platform
	.addComponent(CertManager)
	.addComponent(Chappaai)
	.addComponent(CloudNativePG)
	.addComponent(ExternalSecrets)
	.addComponent(FluxCD)
	.addComponent(PulumiOperator)
	.addComponent(Teleport)
	.addComponent(TemporalOperator)
	.addProject("studio", {
		repository: "oci://ghcr.io/rawkodeacademy/studio-deploy",
		directory: ".",
		environment: {},
		secrets: {
			dopplerToken: secret(
				requireEnvironmentVariable("STUDIO_DOPPLER_SERVICE_TOKEN"),
			),
		},
	});
