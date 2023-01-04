import { Infrastructure } from "./infrastructure";
import { Platform } from "./platform";

const infrastructure = new Infrastructure();

const platform = new Platform("platform", {
	provider: infrastructure.kubernetesProvider,
});

import {
	CertManager,
	CloudNativePG,
	FluxCD,
	PulumiOperator,
} from "./platform/components";

platform
	.addComponent(CertManager)
	.addComponent(CloudNativePG)
	.addComponent(FluxCD)
	.addComponent(PulumiOperator)
	.addProject("studio", {
		repository: "oci://ghcr.io/rawkodeacademy/studio-deploy",
		directory: ".",
		environment: {},
	});
