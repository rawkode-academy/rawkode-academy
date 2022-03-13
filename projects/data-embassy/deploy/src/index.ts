import * as kx from "@pulumi/kubernetesx";

const appLabels = { app: "data-embassy" };

new kx.Deployment("data-embassy", {
  spec: {
    replicas: 1,
    selector: { matchLabels: appLabels },
    template: {
      spec: {
        containers: [
          {
            image: "ghcr.io/rawkode-academy/rawkode-academy/data-embassy:main",
          },
        ],
      },
    },
  },
}).createService();
