import { Infrastructure } from "./infrastructure";
import { Platform } from "./platform";

const infrastructure = new Infrastructure();

const platform = new Platform("platform", {
	provider: infrastructure.kubernetesProvider,
});

import {
	CertManager,
	Chappaai,
	CloudNativePG,
	FluxCD,
	PulumiOperator,
	TemporalOperator,
} from "./platform/components";

platform
	.addComponent(CertManager)
	.addComponent(Chappaai)
	.addComponent(CloudNativePG)
	.addComponent(FluxCD)
	.addComponent(PulumiOperator)
	.addComponent(TemporalOperator)
	.addProject("studio", {
		repository: "oci://ghcr.io/rawkodeacademy/studio-deploy",
		directory: ".",
		environment: {},
	});
