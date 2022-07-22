import * as pulumi from "@pulumi/pulumi";
import * as kubernetes from "@pulumi/kubernetes";

import { Component, ComponentArgs, IngressComponent } from "./abstract";

export class Contour extends Component implements IngressComponent {
  protected readonly version = "7.3.3";
  protected readonly crdsUrl = undefined;

  protected ipAddress: pulumi.Output<string>;

  static getComponentName(): string {
    return "contour";
  }

  constructor(name: string, args: ComponentArgs) {
    super(name, args);

    const ingressController = new kubernetes.helm.v3.Release(
      this.name,
      {
        chart: "contour",
        name: "contour",
        repositoryOpts: {
          repo: "https://charts.bitnami.com/bitnami",
        },
        version: this.version,
        namespace: args.namespace,
        values: {
          defaultBackend: {
            enabled: true,
            containerPorts: {
              http: 8080,
            },
          },
          envoy: {
            useHostPort: false,
          },
        },
      },
      {
        provider: args.provider,
        parent: this,
      }
    );
    this.resources.push(ingressController);

    const ingressService = kubernetes.core.v1.Service.get(
      `${this.name}-contour-service`,
      pulumi.interpolate`${ingressController.status.namespace}/${ingressController.status.name}-envoy`,
      {
        provider: args.provider,
        parent: this,
        dependsOn: [ingressController],
      }
    );

    this.ipAddress = ingressService.status.loadBalancer.ingress[0].ip;
  }

  getIpAddress(): pulumi.Output<string> {
    return this.ipAddress;
  }
}
