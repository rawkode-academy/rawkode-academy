import { Component, ComponentArgs } from "./abstract";

export class CertManager extends Component {
  protected readonly version = "1.7.1";
  protected crdUrls = [
    `https://github.com/cert-manager/cert-manager/releases/download/v${this.version}/cert-manager.crds.yaml`,
  ];

  static getComponentName(): string {
    return "cert-manager";
  }

  constructor(name: string, args: ComponentArgs) {
    super(name, args);

    this.applyCrds();
    this.applyHelmRelease("cert-manager", {
      chart: "cert-manager",
      repositoryOpts: {
        repo: "https://charts.jetstack.io",
      },
      values: {},
    });
  }
}
