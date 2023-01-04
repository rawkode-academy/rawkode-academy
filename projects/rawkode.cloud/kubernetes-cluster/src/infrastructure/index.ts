import * as gcp from "@pulumi/gcp";
import * as google from "@pulumi/google-native";
import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { stackName } from "../utils";

export class Infrastructure extends pulumi.ComponentResource {
	public readonly kubernetesProvider: kubernetes.Provider;

	private network: gcp.compute.Network;
	private firewall: gcp.compute.Firewall;
	private nodeServiceAccount: gcp.serviceaccount.Account;
	private cluster: google.container.v1.Cluster;

	constructor(opts?: pulumi.ComponentResourceOptions) {
		super("rawkode:platform:Infrastructure", "infrastructure", {}, opts);

		this.network = new gcp.compute.Network(
			"network",
			{
				name: stackName("infrastructure"),
				autoCreateSubnetworks: true,
			},
			{ parent: this },
		);

		this.firewall = new gcp.compute.Firewall(
			"firewall",
			{
				name: stackName("infrastructure"),
				network: this.network.name,
				allows: [
					{
						protocol: "tcp",
						ports: ["443"],
					},
				],
				sourceTags: ["allow-https-ingress"],
			},
			{ parent: this },
		);

		this.nodeServiceAccount = new gcp.serviceaccount.Account(
			"node-service-account",
			{
				displayName: stackName("infrastructure-node"),
				accountId: stackName("infrastructure-node"),
			},
			{ parent: this },
		);

		this.cluster = new google.container.v1.Cluster(
			"cluster",
			{
				name: stackName("infrastructure"),
				location: "europe-west2",
				network: this.network.name,
				monitoringService: "none",
				loggingService: "none",
				releaseChannel: {
					channel: "RAPID",
				},
				nodePools: [
					{
						name: "primary",
						config: {
							machineType: "e2-highcpu-8",
							spot: true,
							serviceAccount: this.nodeServiceAccount.email,
							oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
							diskType: "pd-standard",
							diskSizeGb: 60,
						},
						management: {
							autoRepair: true,
							autoUpgrade: true,
						},
						upgradeSettings: {
							strategy: "SURGE",
							maxSurge: 1,
							maxUnavailable: 0,
						},
						// Per Zone
						initialNodeCount: 1,
						autoscaling: {
							enabled: true,
							autoprovisioned: false,
							locationPolicy: "BALANCED",
							totalMaxNodeCount: 9,
							totalMinNodeCount: 3,
						},
					},
				],
				networkConfig: {
					datapathProvider: "ADVANCED_DATAPATH",
				},
				verticalPodAutoscaling: {
					enabled: true,
				},
				workloadIdentityConfig: {
					workloadPool: `${gcp.config.project}.svc.id.goog`,
				},
				addonsConfig: {
					cloudRunConfig: {
						disabled: true,
					},
					configConnectorConfig: {
						enabled: false,
					},
					httpLoadBalancing: {
						disabled: false,
					},
					networkPolicyConfig: {
						disabled: false,
					},
				},
			},
			{ parent: this },
		);

		this.kubernetesProvider = new kubernetes.Provider(
			"provider",
			{
				kubeconfig: this.cluster.getKubeconfig(),
				enableServerSideApply: true,
				deleteUnreachable: true,
			},
			{ parent: this.cluster },
		);
	}
}
