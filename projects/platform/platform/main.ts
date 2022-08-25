import * as cdk8s from "cdk8s";
import { Application } from "./imports/argoproj.io";

const app = new cdk8s.App();
const chart = new cdk8s.Chart(app, "Chart");

new Application(chart, "contour-ingress", {
  metadata: {
    name: "contour-ingress",
  },
  spec: {
    project: "default",
    destination: {},
    source: {
      chart: "contour",
      repoUrl: "https://charts.bitnami.com/bitnami",
      targetRevision: "7.3.3",
      helm: {
        releaseName: "contour",
        values: JSON.stringify({
          defaultBackend: {
            enabled: true,
            containerPorts: {
              http: 8080,
            },
          },
          envoy: {
            useHostPort: false,
          },
        }),
      },
    },
  },
});

app.synth();
