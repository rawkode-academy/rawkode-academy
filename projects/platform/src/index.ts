import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as google from "@pulumi/google-native";
import * as kubernetes from "@pulumi/kubernetes";

const stack = pulumi.getStack();

const stackName = (name: string) => `${stack}-${name}`;

const network = new gcp.compute.Network("network", {
  name: stackName("platform"),
  autoCreateSubnetworks: true,
});

const firewall = new gcp.compute.Firewall("firewall", {
  name: stackName("platform"),
  network: network.name,
  allows: [
    {
      protocol: "tcp",
      ports: ["443"],
    },
  ],
  sourceTags: ["allow-https-ingress"],
});

const nodeServiceAccount = new gcp.serviceaccount.Account(
  "node-service-account",
  {
    displayName: stackName("platform-node"),
    accountId: stackName("platform-node"),
  }
);

const kubernetesCluster = new google.container.v1.Cluster("cluster", {
  name: stackName("platform"),
  location: "europe-west2",
  initialNodeCount: 1,
  network: network.name,
  monitoringService: "none",
  loggingService: "none",
  workloadIdentityConfig: {
    workloadPool: `${gcp.config.project}.svc.id.goog`,
  },
  addonsConfig: {
    cloudRunConfig: {
      disabled: true,
    },
    configConnectorConfig: {
      enabled: true,
    },
    httpLoadBalancing: {
      disabled: false,
    },
    networkPolicyConfig: {
      disabled: false,
    },
  },
});

const primaryNodePool = new gcp.container.NodePool("primary", {
  cluster: kubernetesCluster.id,
  nodeCount: 2,
  nodeConfig: {
    preemptible: true,
    machineType: "e2-medium",
    serviceAccount: nodeServiceAccount.email,
    oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
  },
});

const kubernetesProvider = new kubernetes.Provider("provider", {
  kubeconfig: kubernetesCluster.getKubeconfig(),
});

import { Platform } from "./platform";
import { FluxCD, MongoDbOperator, PulumiOperator } from "./components";

const platform = new Platform("platform", {
  provider: kubernetesProvider,
});

platform
  .addComponent("fluxcd", FluxCD)
  .addComponent("pulumi-operator", PulumiOperator)
  .addComponent("mongodb-operator", MongoDbOperator)
  .addProject("cms-server", {
    repository: "oci://ghcr.io/rawkodeacademy/cms-server-deploy",
    directory: "deploy",
    environment: {
      domain: "cms-server.rawkode.com",
    },
  });
