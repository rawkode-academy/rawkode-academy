import * as kubernetes from "@pulumi/kubernetes";

import { Cluster, NodeType, Region } from "./cluster/scaleway";

const cluster = new Cluster("platform", {
  region: Region.Paris,
  description: "Rawkode Academy Platform Cluster",
  projectId: "7afd6a47-8805-4a55-8a0e-e029a45b28fd",
  kubernetes: {
    version: "1.24",
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

const platformSystemNamespace = new kubernetes.core.v1.Namespace(
  "platform-system",
  {
    metadata: {
      name: "platform-system",
    },
  },
  {
    provider: kubernetesProvider,
    parent: kubernetesProvider,
  }
);

const platformNamespace = new kubernetes.core.v1.Namespace(
  "platform",
  {
    metadata: {
      name: "platform",
    },
  },
  {
    provider: kubernetesProvider,
    parent: kubernetesProvider,
  }
);

const argoCdk8s = new kubernetes.core.v1.ConfigMap(
  "argocdk8s",
  {
    metadata: {
      namespace: platformSystemNamespace.metadata.name,
    },
    immutable: true,
    data: {
      "plugin.yaml": JSON.stringify({
        apiVersion: "argoproj.io/v1alpha1",
        kind: "ConfigManagementPlugin",
        metadata: {
          name: "argocdk8s-typescript",
        },
        spec: {
          version: "v1.0",
          init: {
            command: ["ash"],
            args: [
              "-c",
              "npm install && yarn run cdk8s import && npm run build",
            ],
          },
          generate: {
            command: ["ash"],

            args: ["-c", "cat dist/*"],
          },
          discover: {
            filename: "cdk8s.yaml",
          },
        },
      }),
    },
  },
  {
    parent: platformSystemNamespace,
    provider: kubernetesProvider,
  }
);

const argoCdRelease = new kubernetes.helm.v3.Release(
  "argo-cd",
  {
    namespace: platformSystemNamespace.metadata.name,
    chart: "argo-cd",
    version: "5.3.1",
    repositoryOpts: {
      repo: "https://argoproj.github.io/argo-helm",
    },
    values: {
      repoServer: {
        volumes: [
          {
            name: "argocdk8s",
            configMap: {
              name: argoCdk8s.metadata.name,
            },
          },
          {
            name: "argocdk8s-tmp",
            emptyDir: {},
          },
        ],
        extraContainers: [
          {
            name: "argocdk8s",
            image: "node:current-alpine",
            command: ["ash", "-c"],
            args: [
              "yarn global add cdk8s-cli && /var/run/argocd/argocd-cmp-server",
            ],
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 999,
            },
            env: [
              {
                name: "HOME",
                value: "/tmp/",
              },
              {
                name: "NPM_CONFIG_PREFIX",
                value: "/tmp/node/.npm-global",
              },
            ],
            volumeMounts: [
              {
                name: "var-files",
                mountPath: "/var/run/argocd",
              },
              {
                name: "plugins",
                mountPath: "/home/argocd/cmp-server/plugins",
              },
              {
                name: "argocdk8s",
                mountPath: "/home/argocd/cmp-server/config/plugin.yaml",
                subPath: "plugin.yaml",
              },
              {
                name: "argocdk8s-tmp",
                mountPath: "/tmp",
              },
            ],
          },
        ],
      },
    },
  },
  {
    parent: platformSystemNamespace,
    provider: kubernetesProvider,
  }
);

// const bootstrapApp = new argocd.argoproj.v1alpha1.Application(
const bootstrapApp = new kubernetes.apiextensions.CustomResource(
  "platform",
  {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Application",
    metadata: {
      name: "platform",
      namespace: platformSystemNamespace.metadata.name,
    },
    spec: {
      project: "default",
      destination: {
        server: "https://kubernetes.default.svc",
        namespace: platformNamespace.metadata.name,
      },
      source: {
        path: "./projects/platform/platform",
        repoURL: "https://github.com/RawkodeAcademy/RawkodeAcademy",
        plugin: {},
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: true,
        },
      },
    },
  },
  {
    parent: kubernetesProvider,
    provider: kubernetesProvider,
    dependsOn: argoCdRelease,
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
