import * as kubernetes from "@pulumi/kubernetes";
import * as kubernetesx from "@pulumi/kubernetesx";

const appLabels = { app: "data-embassy" };
const nginxLabels = { app: "nginx" };

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

const nginx = new kubernetes.apps.v1.Deployment("nginx", {
  metadata: {
    name: "nginx",
  },
  spec: {
    replicas: 1,
    selector: {
      matchLabels: nginxLabels,
    },
    template: {
      metadata: {
        labels: nginxLabels,
      },
      spec: {
        containers: [
          {
            name: "nginx",
            image: "nginx",
          },
        ],
      },
    },
  },
});

const environment = kubernetes.core.v1.ConfigMap.get(
  "environment",
  "environment"
);

const apiIngress = new kubernetes.apiextensions.CustomResource("api", {
  apiVersion: "projectcontour.io/v1",
  kind: "HTTPProxy",
  metadata: {
    name: "api.rawkode.academy",
  },
  spec: {
    virtualhost: {
      fqdn: "api.rawkode.academy",
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
