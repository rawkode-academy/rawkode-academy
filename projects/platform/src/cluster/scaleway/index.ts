import * as pulumi from "@pulumi/pulumi";
import * as scaleway from "@jaxxstorm/pulumi-scaleway";

interface ClusterConfiguration {
  region: Region;
  projectId: string;
  kubernetes: KubernetesConfiguration;

  description?: string;
  tags?: string[];
}

interface NodePoolConfiguration {
  autohealing: boolean;
  autoscaling: boolean;
  size: number;
  minSize: number;
  maxSize: number;
  nodeType: NodeType;
  containerRuntime: "containerd";
}

interface KubernetesConfiguration {
  version: string;
  cni: string;
}

export const enum Region {
  Amsterdam = "nl-ams",
  Paris = "fr-par",
  Warsaw = "pl-waw",
}

export const enum NodeType {
  D3M4 = "DEV1-M",
  D4M8 = "DEV1-L",
  D4M12 = "DEV1-XL",

  X2M2 = "PRO2-XXS",
  X4M16 = "PRO2-XS",
  X8M32 = "PRO2-S",
  X16M64 = "PRO2-M",
  X32M128 = "PRO2-L",
}

export class Cluster extends pulumi.ComponentResource {
  private readonly name: string;
  private readonly configuration: ClusterConfiguration;
  private readonly cluster: scaleway.KubernetesCluster;
  private readonly nodePools: Map<String, scaleway.KubernetesNodePool> =
    new Map();

  constructor(name: string, configuration: ClusterConfiguration) {
    super("rawkode:platform:Cluster", name, {});

    this.name = name;
    this.configuration = configuration;

    this.cluster = new scaleway.KubernetesCluster(
      name,
      {
        name: name,
        region: this.configuration.region,
        projectId: this.configuration.projectId,
        description: this.configuration.description,

        autoUpgrade: {
          enable: true,
          maintenanceWindowDay: "sunday",
          maintenanceWindowStartHour: 3,
        },

        cni: this.configuration.kubernetes.cni,
        version: this.configuration.kubernetes.version,

        type: "kapsule",
        deleteAdditionalResources: true,
      },
      {
        parent: this,
        ignoreChanges: ["version"],
      }
    );
  }

  public get kubeconfig() {
    return this.cluster.kubeconfigs[0].configFile;
  }

  public addNodePool(name: string, config: NodePoolConfiguration) {
    if (this.nodePools.has(`${this.name}-${name}`)) {
      throw new Error(`Node pool '${name}' already exists`);
    }

    this.nodePools.set(
      `${this.name}-${name}`,
      new scaleway.KubernetesNodePool(
        `${this.name}-${name}`,
        {
          clusterId: this.cluster.id,
          autohealing: config.autohealing,
          autoscaling: config.autoscaling,
          size: config.size,
          minSize: config.minSize,
          maxSize: config.maxSize,
          nodeType: config.nodeType,
          containerRuntime: config.containerRuntime,
          upgradePolicy: {
            maxSurge: 1,
            maxUnavailable: 1,
          },
        },
        {
          parent: this.cluster,
        }
      )
    );
  }
}
