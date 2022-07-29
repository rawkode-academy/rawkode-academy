import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

export interface ComponentArgs {
  namespace: string | pulumi.Output<string>;
  provider: kubernetes.Provider;
}

export interface IngressComponent {
  getIpAddress(): pulumi.Output<string>;
}

export abstract class Component extends pulumi.ComponentResource {
  protected abstract readonly crdsUrl?: string;
  protected abstract readonly version: string;

  static getComponentName(): string {
    throw new Error(`getComponentName not implemented for ${this.name}`);
  }

  protected readonly provider: kubernetes.Provider;
  protected readonly namespace: string | pulumi.Output<String>;

  protected resources: pulumi.Resource[] = [];

  constructor(args: ComponentArgs) {
    super(`rawkode:platform:ingress-controller`, "ingress-controller");

    this.namespace = args.namespace;
    this.provider = args.provider;
  }

  public getResources(): pulumi.Resource[] {
    return this.resources;
  }
}
