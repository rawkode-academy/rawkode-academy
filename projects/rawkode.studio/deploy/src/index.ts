import * as kubernetes from "@pulumi/kubernetes";

const redpandaCluster = new kubernetes.apiextensions.CustomResource("cluster", {
  apiVersion: "redpanda.vectorized.io/v1alpha1",
  kind: "Cluster",
  metadata: {
    annotations: {
      "pulumi.com/skipAwait": "true",
    },
  },
  spec: {
    image: "vectorized/redpanda",
    version: "latest",
    replicas: 1,
    resources: {
      requests: {
        cpu: 1,
        memory: "1.2G",
      },
      limits: {
        cpu: 1,
        memory: "1.2G",
      },
    },
    configuration: {
      rpcServer: {
        port: 33145,
      },
      kafkaApi: [
        {
          port: 9092,
          tls: {
            enabled: true,
            requireClientAuth: true,
          },
        },
      ],
      pandaproxyApi: [
        {
          port: 8082,
          tls: {
            enabled: true,
            requireClientAuth: true,
          },
        },
      ],
      schemaRegistry: {
        port: 8081,
        tls: {
          enabled: true,
          requireClientAuth: true,
        },
      },
      adminApi: [
        {
          port: 9644,
          tls: {
            enabled: true,
            requireClientAuth: true,
          },
        },
      ],
      developerMode: false,
    },
  },
});
