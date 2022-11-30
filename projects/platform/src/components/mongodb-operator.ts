import * as kubernetes from "@pulumi/kubernetes";

import { Component, ComponentArgs } from "./abstract";

export class MongoDbOperator extends Component {
  protected readonly version = "1.10.1";
  protected readonly crdsUrl =
    "https://raw.githubusercontent.com/pulumi/pulumi-kubernetes-operator/v${VERSION}/deploy/crds/pulumi.com_stacks.yaml";

  static getComponentName(): string {
    return "pulumi-operator";
  }

  constructor(name: string, args: ComponentArgs) {
    super(name, args);

    const crds = new kubernetes.helm.v3.Release(
      `${this.name}-crds`,
      {
        chart: "community-operator-crds",
        repositoryOpts: {
          repo: "https://mongodb.github.io/helm-charts",
        },
      },
      { provider: this.provider, parent: this }
    );

    new kubernetes.helm.v3.Release(
      `${this.name}-operator`,
      {
        chart: "community-operator",
        repositoryOpts: {
          repo: "https://mongodb.github.io/helm-charts",
        },
        values: {
          "community-operator-crds": {
            enabled: false,
          },
          operator: {
            watchNamespace: "*",
          },
        },
      },
      {
        dependsOn: [crds],
        provider: this.provider,
        parent: this,
      }
    );
  }
}
