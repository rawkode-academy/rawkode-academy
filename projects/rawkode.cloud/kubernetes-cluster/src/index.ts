import { Infrastructure } from "./infrastructure";
import { Platform } from "./platform";

const infrastructure = new Infrastructure();

const platform = new Platform("platform", {
  provider: infrastructure.kubernetesProvider,
});

import {
  CertManager,
  FluxCD,
  PulumiOperator,
  Redpanda,
} from "./platform/components";

platform
  .addComponent(FluxCD)
  .addComponent(PulumiOperator)
  .addComponent(CertManager)
  .addComponent(Redpanda)
  .addProject("studio", {
    repository: "oci://ghcr.io/rawkodeacademy/studio-deploy",
    directory: ".",
    environment: {},
  });
