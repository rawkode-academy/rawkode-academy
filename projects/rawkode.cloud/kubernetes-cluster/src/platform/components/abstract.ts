import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

export interface ComponentArgs {
  parent: pulumi.Resource;
  dependsOn: pulumi.Resource[];
  namespace: kubernetes.core.v1.Namespace;
  provider: kubernetes.Provider;
}

export interface IngressComponent {
  getIpAddress(): pulumi.Output<string>;
}

export abstract class Component extends pulumi.ComponentResource {
  protected abstract readonly crdUrls?: string[];
  protected abstract readonly version: string;

  static getComponentName(): string {
    throw new Error(`getComponentName not implemented for ${this.name}`);
  }

  static getDependencies(): string[] {
    return [];
  }

  protected readonly name: string;
  protected readonly parent: pulumi.Resource;
  protected readonly provider: kubernetes.Provider;
  protected readonly namespace: kubernetes.core.v1.Namespace;

  protected resources: pulumi.Resource[] = [];

  constructor(name: string, args: ComponentArgs) {
    super(`platform:component:${name}`, name, {}, args);

    this.name = name;
    this.namespace = args.namespace;
    this.provider = args.provider;
    this.parent = args.parent;
  }

  protected applyCrds(): kubernetes.yaml.ConfigGroup | null {
    if (this.crdUrls?.length === 0) {
      return null;
    }

    return new kubernetes.yaml.ConfigGroup(
      `${this.name}-crds`,
      {
        files: this.crdUrls?.map((url) =>
          url.replace("${VERSION}", this.version)
        ),
      },
      { provider: this.provider, parent: this }
    );
  }

  protected applyYaml(
    name: string,
    location: string
  ): kubernetes.yaml.ConfigFile {
    return new kubernetes.yaml.ConfigFile(
      `${this.name}-${name}`,
      {
        file: location,
        transformations: [
          (obj: any) => {
            obj.metadata.namespace = this.namespace.metadata.name;
            obj.metadata.annotations = {
              "pulumi.com/skipAwait": "true",
            };
          },
        ],
      },
      { provider: this.provider, parent: this }
    );
  }

  protected applyHelmRelease(
    name: string,
    args: kubernetes.helm.v3.ReleaseArgs
  ): kubernetes.helm.v3.Release {
    return new kubernetes.helm.v3.Release(
      this.name,
      {
        ...args,
        namespace: this.namespace.metadata.name,
        cleanupOnFail: true,
        skipAwait: true,
        createNamespace: false,
      },
      {
        provider: this.provider,
        parent: this,
      }
    );
  }

  public getDependencies(): string[] {
    return [];
  }

  public getResources(): pulumi.Resource[] {
    return this.resources;
  }
}
