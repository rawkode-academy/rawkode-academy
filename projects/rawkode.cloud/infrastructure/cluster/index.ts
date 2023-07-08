import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { GoogleProvider } from "../.gen/providers/google/provider";
import { ComputeNetwork } from "../.gen/providers/google/compute-network";
import { ServiceAccount } from "../.gen/providers/google/service-account";
import { ContainerCluster } from "../.gen/providers/google/container-cluster";
import { ContainerNodePool } from "../.gen/providers/google/container-node-pool";

export const location = "europe-west4-a";

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
			autoCreateSubnetworks: true,
			project: config.project,
		});

		const cluster = new ContainerCluster(this, "cluster", {
			name: "rawkode-cloud",
			location,
			removeDefaultNodePool: true,
			initialNodeCount: 1,
			minMasterVersion: "1.27.2-gke.1200",
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
			verticalPodAutoscaling: {
				enabled: false,
			},
			datapathProvider: "ADVANCED_DATAPATH",
			nodeConfig: {
				spot: true,
			},
			network: network.name,
			networkingMode: "VPC_NATIVE",
			ipAllocationPolicy: {
				clusterIpv4CidrBlock: "10.16.0.0/16",
				servicesIpv4CidrBlock: "10.32.0.0/16",
			},
			project: config.project,
			releaseChannel: {
				channel: "RAPID",
			},

			workloadIdentityConfig: {
				workloadPool: `${config.project}.svc.id.goog`,
			},
			loggingConfig: {
				enableComponents: [],
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

		new ContainerNodePool(this, "amd64", {
			name: "amd64",
			cluster: cluster.name,
			project: config.project,
			location,
			nodeCount: 3,
			nodeConfig: {
				spot: true,
				machineType: "e2-standard-4",
				serviceAccount: serviceAccount.email,
				oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
			},
		});

		// Arm machines are free, up to 220USD per month, until 2024.
		new ContainerNodePool(this, "arm64", {
			name: "arm64",
			cluster: cluster.name,
			project: config.project,
			location,
			nodeCount: 3,

			nodeConfig: {
				spot: true,
				machineType: "t2a-standard-4",
				serviceAccount: serviceAccount.email,
				oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
			},
		});
	}
}
