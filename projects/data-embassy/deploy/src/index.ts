import * as kubernetes from "@pulumi/kubernetes";
import * as kubernetesx from "@pulumi/kubernetesx";

const appLabels = { app: "data-embassy" };

const cm = kubernetes.core.v1.ConfigMap.get("environment", "environment", {});

export interface Environment {
  name: string;
  apiDomain: string;
  serviceNamespace: string;
  ingressEnabled: boolean;
  networkPoliciesEnforced: boolean;
}

const env = cm.data.apply((data): Environment => JSON.parse(data["v1"]));

const deploy = new kubernetesx.Deployment("data-embassy", {
  metadata: {
    labels: appLabels,
  },
  spec: {
    replicas: 1,
    selector: { matchLabels: appLabels },
    template: {
      metadata: {
        labels: appLabels,
      },
      spec: {
        containers: [
          {
            image: "ghcr.io/rawkode-academy/rawkode-academy/data-embassy:main",
          },
        ],
      },
    },
  },
}).createService({
  ports: [{ port: 8080 }],
});

const apiIngress = new kubernetes.apiextensions.CustomResource("api", {
  apiVersion: "projectcontour.io/v1",
  kind: "HTTPProxy",
  metadata: {
    name: env.apiDomain,
  },
  spec: {
    virtualhost: {
      fqdn: env.apiDomain,
    },
    routes: [
      {
        conditions: [{ prefix: "/" }],
        services: [
          {
            name: deploy.metadata.name,
            port: 8080,
          },
        ],
      },
    ],
  },
});
