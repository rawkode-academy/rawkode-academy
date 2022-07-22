import * as scaleway from "@jaxxstorm/pulumi-scaleway";
import * as kubernetes from "@pulumi/kubernetes";
import * as doppler from "@pulumiverse/doppler";

const kubernetesCluster = new scaleway.KubernetesCluster("platform", {
  cni: "cilium",
  version: "1.23.6",
  type: "kapsule",
  deleteAdditionalResources: true,
});

const essentialNodePool = new scaleway.KubernetesNodePool(
  "platform-essential",
  {
    clusterId: kubernetesCluster.id,
    autohealing: true,
    autoscaling: true,
    size: 1,
    minSize: 1,
    maxSize: 2,
    nodeType: "PRO2-XXS",
    containerRuntime: "containerd",
    upgradePolicy: {
      maxSurge: 1,
      maxUnavailable: 1,
    },
  }
);

const ephemeralNodePool = new scaleway.KubernetesNodePool(
  "platform-ephemeral",
  {
    clusterId: kubernetesCluster.id,
    autohealing: true,
    autoscaling: true,
    size: 3,
    minSize: 3,
    maxSize: 9,
    nodeType: "DEV1-M",
    containerRuntime: "containerd",
    upgradePolicy: {
      maxSurge: 2,
      maxUnavailable: 1,
    },
  }
);

const kubeconfig = kubernetesCluster.kubeconfigs[0].configFile;

const kubernetesProvider = new kubernetes.Provider("platform", {
  kubeconfig,
});

const dopplerKubeconfig = new doppler.Secret("platform-kubeconfig", {
  project: "platform",
  config: "production",
  name: "KUBECONFIG_RAW",
  value: kubeconfig,
});

import { Contour } from "./ingress-controllers/contour";

const platformSystemNamespace = new kubernetes.core.v1.Namespace(
  "platform-system",
  {
    metadata: {
      name: "platform-system",
    },
  },
  {
    provider: kubernetesProvider,
  }
);
const ingressController = new Contour("ingress-controller", {
  namespace: platformSystemNamespace.metadata.name,
  provider: kubernetesProvider,
});

const cmsDopplerOperatorToken = process.env.CMS_DOPPLER_OPERATOR_TOKEN!;

const dopplerCmsToken = new kubernetes.core.v1.Secret(
  "cms-doppler-operator",
  {
    data: {
      serviceToken: Buffer.from(cmsDopplerOperatorToken).toString("base64"),
    },
  },
  {
    provider: kubernetesProvider,
  }
);

const dopplerSecret = new kubernetes.apiextensions.CustomResource(
  "doppler-cms",
  {
    apiVersion: "secrets.doppler.com/v1alpha1",
    kind: "DopplerSecret",
    spec: {
      tokenSecret: {
        name: dopplerCmsToken.metadata.name,
      },
      managedSecret: {
        name: "doppler-cms",
      },
    },
  },
  {
    provider: kubernetesProvider,
  }
);

const cms = new kubernetes.apps.v1.Deployment(
  "cms",
  {
    metadata: {
      annotations: {
        "pulumi.com/skipAwait": "true",
      },
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: "cms",
        },
      },
      template: {
        metadata: {
          labels: {
            app: "cms",
          },
        },
        spec: {
          containers: [
            {
              name: "cms",
              image: "ghcr.io/rawkodeacademy/cms:latest",
              imagePullPolicy: "Always",
            },
          ],
        },
      },
    },
  },
  {
    provider: kubernetesProvider,
  }
);

const dopplerRelease = new kubernetes.helm.v3.Release(
  "doppler",
  {
    chart: "doppler-kubernetes-operator",
    repositoryOpts: {
      repo: "https://helm.doppler.com",
    },
  },
  {
    provider: kubernetesProvider,
  }
);
