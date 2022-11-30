import * as kubernetes from "@pulumi/kubernetes";

import { Component, ComponentArgs } from "./abstract";

export class FluxCD extends Component {
  protected readonly version = "0.37.0";
  protected crdsUrl = `https://github.com/fluxcd/flux2/releases/download/v${this.version}/install.yaml`;

  static getComponentName(): string {
    return "fluxcd";
  }

  constructor(name: string, args: ComponentArgs) {
    super(name, args);

    // For Flux, we just install everything as they publish the install.yaml on their release.
    // Each controller does publish its own CRD.yaml
    // perhaps we could be better about this in the future
    new kubernetes.yaml.ConfigFile(
      `${this.name}-crds`,
      { file: this.crdsUrl.replace("${VERSION}", this.version) },
      { provider: this.provider, parent: this }
    );
  }
}
