import * as cdk8s from "cdk8s";
import * as gateway from "./imports/gateway.networking.k8s.io";
import * as contour from "./imports/projectcontour.io";

const app = new cdk8s.App();
const chart = new cdk8s.Chart(app, "Chart");

cdk8s.Yaml.load(
  "https://projectcontour.io/quickstart/contour-gateway-provisioner.yaml"
);

new gateway.GatewayClass(chart, "contour", {
  metadata: {
    name: "contour",
  },
  spec: {
    controllerName: "projectcontour.io/gateway-controller",
  },
});

new gateway.Gateway(chart, "contour", {
  metadata: {
    name: "contour",
  },
  spec: {
    gatewayClassName: "contour",
    listeners: [
      {
        name: "http",
        protocol: "HTTP",
        port: 80,
        allowedRoutes: {
          namespaces: {
            from: gateway.GatewaySpecListenersAllowedRoutesNamespacesFrom.ALL,
          },
        },
      },
    ],
  },
});
