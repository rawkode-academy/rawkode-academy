import * as cdk8s from "cdk8s";
import * as gateway from "./imports/gateway.networking.k8s.io";

const app = new cdk8s.App();
const chart = new cdk8s.Chart(app, "Chart");

const crds = new cdk8s.Include(chart, "contour-gateway-api-crds", {
  url: "https://raw.githubusercontent.com/projectcontour/contour/v1.22.0/examples/gateway/00-crds.yaml",
});

const contourGatewayClass = new gateway.GatewayClass(
  chart,
  "contour-gateway-class",
  {
    metadata: {
      name: "contour",
    },
    spec: {
      controllerName: "projectcontour.io/gateway-controller",
    },
  }
);

contourGatewayClass.addDependency(crds);

const contourGateway = new gateway.Gateway(chart, "contour-gateway", {
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

contourGateway.addDependency(contourGatewayClass);

new cdk8s.Helm(chart, "contour", {
  releaseName: "contour",
  chart: "bitnami/contour",
  helmFlags: ["--skip-crds"],
  values: {
    contour: {
      manageCRDs: false,
    },
    defaultBackend: {
      enabled: true,
      containerPorts: {
        http: 8080,
      },
    },
    envoy: {
      useHostPort: false,
    },
    configInline: {
      disablePermitInsecure: false,
      tls: {
        "fallback-certificate": {},
        "accesslog-format": "envoy",
      },
      gateway: {
        controllerName: "projectcontour.io/gateway-controller",
      },
    },
  },
});

app.synth();
