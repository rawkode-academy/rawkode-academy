import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { ComputeNetwork } from "../.gen/providers/google/compute-network";
import { ComputeSubnetwork } from "../.gen/providers/google/compute-subnetwork";
import { ContainerCluster } from "../.gen/providers/google/container-cluster";
import { ContainerNodePool } from "../.gen/providers/google/container-node-pool";
import { GoogleProvider } from "../.gen/providers/google/provider";
import { ServiceAccount } from "../.gen/providers/google/service-account";

export const region = "europe-west4";

interface Config {
  project: string;
}

export class Cluster extends TerraformStack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);

    new GoogleProvider(this, "google", {
      alias: "google",
      project: config.project,
    });

    const serviceAccount = new ServiceAccount(this, "service-account", {
      accountId: "rawkode-cloud",
      displayName: "rawkode.cloud",
      project: config.project,
    });

    const network = new ComputeNetwork(this, "network", {
      name: "rawkode-cloud",
      autoCreateSubnetworks: false,
      project: config.project,
    });

    const regionSubnet = new ComputeSubnetwork(this, "subnet", {
      name: region,
      region,
      project: config.project,
      network: network.selfLink,
      ipCidrRange: "10.0.0.0/16",
      secondaryIpRange: [
        {
          rangeName: "kubernetes-pods",
          ipCidrRange: "10.16.0.0/16",
        },
        {
          rangeName: "kubernetes-services",
          ipCidrRange: "10.32.0.0/16",
        }
      ]
    });

    const cluster = new ContainerCluster(this, "cluster", {
      name: "rawkode-cloud",
      project: config.project,
      location: region,

      releaseChannel: {
        channel: "RAPID",
      },

      initialNodeCount: 1,
      removeDefaultNodePool: true,
      nodeConfig: {
        spot: true,
      },

      network: network.selfLink,
      subnetwork: regionSubnet.selfLink,

      networkingMode: "VPC_NATIVE",
      ipAllocationPolicy: {
        clusterSecondaryRangeName: "kubernetes-pods",
        servicesSecondaryRangeName: "kubernetes-services",
      },

      datapathProvider: "ADVANCED_DATAPATH",

      maintenancePolicy: {
        dailyMaintenanceWindow: {
          startTime: "02:00",
        },
      },

      monitoringConfig: {
        enableComponents: [],
        managedPrometheus: {
          enabled: false,
        },
      },

      loggingConfig: {
        enableComponents: [],
      },

      verticalPodAutoscaling: {
        enabled: false,
      },

      workloadIdentityConfig: {
        workloadPool: `${config.project}.svc.id.goog`,
      },

      addonsConfig: {
        cloudrunConfig: {
          disabled: true,
        },
        configConnectorConfig: {
          enabled: false,
        },
        horizontalPodAutoscaling: {
          disabled: true,
        },
        httpLoadBalancing: {
          disabled: false,
        },
        gcpFilestoreCsiDriverConfig: {
          enabled: true,
        },
        gcePersistentDiskCsiDriverConfig: {
          enabled: true,
        },
        dnsCacheConfig: {
          enabled: true,
        },
        gkeBackupAgentConfig: {
          enabled: false,
        },
      },
    });

    new ContainerNodePool(this, "primary", {
      namePrefix: "primary",
      cluster: cluster.name,
      project: config.project,
      location: region,
      nodeCount: 1,
      nodeConfig: {
        spot: true,
        machineType: "e2-standard-4",
        diskSizeGb: 50,
        diskType: "pd-balanced",
        serviceAccount: serviceAccount.email,
        oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
      },
      management: {
        autoRepair: true,
        autoUpgrade: true,
      },
      upgradeSettings: {
        maxSurge: 2,
        maxUnavailable: 1,
      },
      dependsOn: [regionSubnet],
    });

    // Arm machines are free, up to 220USD per month, until 2024.
    // new ContainerNodePool(this, "arm64", {
    //   name: "arm64",
    //   cluster: cluster.name,
    //   project: config.project,
    //   location,
    //   nodeCount: 3,

    //   nodeConfig: {
    //     spot: true,
    //     machineType: "t2a-standard-4",
    //     serviceAccount: serviceAccount.email,
    //     oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
    //   },
    // });
  }
}
