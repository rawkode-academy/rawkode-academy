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
  name: "KUBECONFIG",
  value: kubeconfig,
});
