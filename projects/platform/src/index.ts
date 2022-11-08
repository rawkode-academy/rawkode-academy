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

const porchInstall = new kubernetes.yaml.ConfigFile(
  "porch-install",
  {
    file: "../bootstrap/porch.yaml",
  },
  {
    provider: kubernetesProvider,
  }
);

// const gkehubMembership = new gcp.gkehub.Membership("membership", {
//   membershipId: stackName("platform"),
//   endpoint: {
//     gkeCluster: {
//       resourceLink: `//container.googleapis.com/${kubernetesCluster.id}`,
//     },
//   },
//   authority: {
//     issuer: `https://container.googleapis.com/v1/${kubernetesCluster.id}`,
//   },
// });

// const gkehubConfigManagement = new gcp.gkehub.Feature("configmanagement", {
//   name: "configmanagement",
//   location: "global",
// });

// const gkehubConfigManagementMembership = new gcp.gkehub.FeatureMembership(
//   "configmanagement",
//   {
//     location: "global",
//     feature: gkehubConfigManagement.name,
//     membership: gkehubMembership.id,
//     configmanagement: {
//       version: "1.6.2",
//       configSync: {

//         git: {
//           syncRepo: "https://github.com/RawkodeAcademy/RawkodeAcademy",
//           syncBranch: "main",
//           policyDir: "./projects/platform/gitops",
//         },
//       },
//     },
//   }
// );
