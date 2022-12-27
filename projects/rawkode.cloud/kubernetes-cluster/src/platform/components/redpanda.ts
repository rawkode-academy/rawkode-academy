import { Component, ComponentArgs } from "./abstract";
import { CertManager } from "./cert-manager";

export class Redpanda extends Component {
  protected readonly version = "22.3.9";

  static getComponentName(): string {
    return "redpanda";
  }

  static getDependencies(): string[] {
    return [CertManager.getComponentName()];
  }

  constructor(name: string, args: ComponentArgs) {
    super(name, args);

    // CRDs are a Kustomize directory
    this.applyKustomization(
      "redpanda-crds",
      `https://github.com/redpanda-data/redpanda/tree/v${this.version}/src/go/k8s/config/crd`
    );

    this.applyHelmRelease("redpanda", {
      chart: "redpanda-operator",
      repositoryOpts: {
        repo: "https://charts.vectorized.io",
      },
      values: {
        webhookSecretName: "redpanda-webhook-server-cert",
      },
    });
  }
}
