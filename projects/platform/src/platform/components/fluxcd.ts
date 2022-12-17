import { Component, ComponentArgs } from "./abstract";

export class FluxCD extends Component {
  protected readonly version = "v0.37.0";
  protected crdUrls = [];

  static getComponentName(): string {
    return "fluxcd";
  }

  constructor(name: string, args: ComponentArgs) {
    super(name, args);

    this.applyHelmRelease("fluxcd", {
      chart: "flux2",
      repositoryOpts: {
        repo: "https://fluxcd-community.github.io/helm-charts",
      },
      values: {
        watchAllNamespaces: true,
        // By default, Flux applies NetworkPolicies to restrict traffic to the
        // contorllers. Our Pulumi's need to speak to them.
        policies: {
          create: false,
        },
        helmController: {
          create: false,
        },
        kustomizeController: {
          create: false,
        },
      },
    });
  }
}
