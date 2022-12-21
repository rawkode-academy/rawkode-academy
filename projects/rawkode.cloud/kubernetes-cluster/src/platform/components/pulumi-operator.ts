import * as kubernetes from "@pulumi/kubernetes";

import { Component, ComponentArgs } from "./abstract";

export class PulumiOperator extends Component {
  protected readonly version = "1.10.1";
  protected readonly crdUrls = [
    "https://raw.githubusercontent.com/pulumi/pulumi-kubernetes-operator/v${VERSION}/deploy/crds/pulumi.com_stacks.yaml",
    "https://raw.githubusercontent.com/pulumi/pulumi-kubernetes-operator/v${VERSION}/deploy/crds/pulumi.com_programs.yaml",
  ];

  static getComponentName(): string {
    return "pulumi-operator";
  }

  constructor(name: string, args: ComponentArgs) {
    super(name, args);

    this.applyCrds();
  }
}
