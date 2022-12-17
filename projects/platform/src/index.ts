import { Infrastructure } from "./infrastructure";
import { Platform } from "./platform";

const infrastructure = new Infrastructure();

const platform = new Platform("platform", {
  provider: infrastructure.kubernetesProvider,
});

import { FluxCD, PulumiOperator } from "./platform/components";

platform.addComponent(FluxCD).addComponent(PulumiOperator);
// .addProject("example", {
//   repository: "oci://ghcr.io/rawkodeacademy/cms-server-deploy",
//   directory: "deploy",
//   environment: {},
// });
