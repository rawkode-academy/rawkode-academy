import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

interface Args {
  provider: kubernetes.Provider;
}

export class PulumiOperator extends pulumi.ComponentResource {
  protected readonly version = "1.7.0";
  protected readonly crdsUrl =
    "https://raw.githubusercontent.com/pulumi/pulumi-kubernetes-operator/v${VERSION}/deploy/crds/pulumi.com_stacks.yaml";

  static getComponentName(): string {
    return "pulumi-operator";
  }

  constructor(args: Args) {
    super("rawkode:platform:pulumi", "pulumi-operator", {});

    new kubernetes.yaml.ConfigFile(
      "pulumi-operator-crds",
      { file: this.crdsUrl.replace("${VERSION}", this.version) },
      { provider: args.provider, parent: this }
    );
  }
}
