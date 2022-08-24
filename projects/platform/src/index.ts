import * as doppler from "@pulumiverse/doppler";
import * as kubernetes from "@pulumi/kubernetes";

import { Cluster, NodeType, Region } from "./cluster/scaleway";

const cluster = new Cluster("platform", {
  region: Region.Paris,
  description: "Rawkode Academy Platform Cluster",
  projectId: "7afd6a47-8805-4a55-8a0e-e029a45b28fd",
  kubernetes: {
    version: "1.23",
    cni: "cilium",
  },
});

cluster.addNodePool("essential", {
  autohealing: true,
  autoscaling: true,
  containerRuntime: "containerd",
  maxSize: 2,
  minSize: 1,
  size: 1,
  nodeType: NodeType.X2M2,
});

cluster.addNodePool("ephemeral", {
  autohealing: true,
  autoscaling: true,
  containerRuntime: "containerd",
  maxSize: 9,
  minSize: 3,
  size: 3,
  nodeType: NodeType.D3M4,
});

const kubeconfig = cluster.kubeconfig;

const kubernetesProvider = new kubernetes.Provider("platform", {
  kubeconfig,
});

const platformBootstrap = new kubernetes.kustomize.Directory(
  "bootstrap",
  {
    directory: "../platform-bootstrap",
  },
  {
    provider: kubernetesProvider,
  }
);

// const dopplerKubeconfig = new doppler.Secret("kubeconfig", {
//   project: "platform",
//   config: "production",
//   name: "KUBECONFIG_RAW",
//   value: kubeconfig,
// });

// import { Contour } from "./ingress-controllers/contour";

// const platformSystemNamespace = new kubernetes.core.v1.Namespace(
//   "platform-system",
//   {
//     metadata: {
//       name: "platform-system",
//     },
//   },
//   {
//     provider: kubernetesProvider,
//   }
// );
// const ingressController = new Contour({
//   namespace: platformSystemNamespace.metadata.name,
//   provider: kubernetesProvider,
// });

// // const dopplerRelease = new kubernetes.helm.v3.Release(
// //   "doppler",
// //   {
// //     chart: "doppler-kubernetes-operator",
// //     repositoryOpts: {
// //       repo: "https://helm.doppler.com",
// //     },
// //   },
// //   {
// //     provider: kubernetesProvider,
// //   }
// // );

// import { PulumiOperator } from "./pulumiOperator";
// const pulumiOperator = new PulumiOperator({
//   provider: kubernetesProvider,
// });

// import { Project } from "./project";
// const cmsProject = new Project("cms", {
//   repository: "https://github.com/RawkodeAcademy/RawkodeAcademy",
//   directory: "projects/cms/pulumi",
//   platformDependency: [],
//   environment: {},
//   provider: kubernetesProvider,
//   requireSecrets: [
//     "GITHUB_TOKEN_WRITE_PACKAGES",
//     "MONGODB_ATLAS_ORG_ID",
//     "MONGODB_ATLAS_PRIVATE_KEY",
//     "MONGODB_ATLAS_PUBLIC_KEY",
//   ],
// });
