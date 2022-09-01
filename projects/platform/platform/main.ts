import * as cdk8s from "cdk8s";

const app = new cdk8s.App();
const chart = new cdk8s.Chart(app, "Chart");

new cdk8s.Helm(chart, "redis", {
  chart: "bitnami/contour",
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
});

app.synth();
