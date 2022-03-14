import * as kx from "@pulumi/kubernetesx";

const appLabels = { app: "data-embassy" };

new kx.Deployment("data-embassy", {
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
