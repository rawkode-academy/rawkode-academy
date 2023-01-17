import { Construct } from "constructs";
import {
	App,
	TerraformStack,
	CloudBackend,
	NamedCloudWorkspace,
	Fn,
} from "cdktf";
import { ScalewayProvider } from "@generatedProviders/scaleway/provider";
import { AccountProject } from "@generatedProviders/scaleway/account-project";
import {
	K8SCluster,
	K8SClusterKubeconfigOutputReference,
} from "@generatedProviders/scaleway/k8s-cluster";
import { K8SPool } from "@generatedProviders/scaleway/k8s-pool";
import { KubernetesProvider } from "@generatedProviders/kubernetes/provider";
import { Deployment } from "@generatedProviders/kubernetes/deployment";
// import { HelmProvider } from "@generatedProviders/helm/provider";

enum Regions {
	AMS = "nl-ams",
	PAR = "fr-par",
	WAW = "pl-waw",
}

enum Zones {
	AMS1 = "nl-ams-1",
	AMS2 = "nl-ams-2",
	PAR1 = "fr-par-1",
	PAR2 = "fr-par-2",
	WAW1 = "pl-waw-1",
}
class Platform extends TerraformStack {
	private readonly project: AccountProject;
	private readonly cluster: K8SCluster;
	private readonly nodePools: K8SPool[] = [];
	private readonly kubeconfig: K8SClusterKubeconfigOutputReference;
	private readonly kubernetesProvider: KubernetesProvider;
	// private readonly helmProvider: HelmProvider;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		new ScalewayProvider(this, "scaleway", {
			organizationId: "b07462e9-1a00-43b4-a6a8-6e3004a31984",
		});

		this.project = new AccountProject(this, "project", {
			name: `platform-${id}`,
			description: `${id} platform for Rawkode Academy's Core Infrastructure`,
		});

		this.cluster = new K8SCluster(this, "k8s", {
			name: "platform",
			description: "Platform Cluster for Rawkode Academy",
			version: "1.24",
			type: "kapsule",
			projectId: this.project.id,
			region: Regions.AMS,
			cni: "cilium",
			admissionPlugins: [],
			autoUpgrade: {
				enable: true,
				maintenanceWindowDay: "any",
				maintenanceWindowStartHour: 2,
			},
			deleteAdditionalResources: true,
		});

		this.kubeconfig = this.cluster.kubeconfig.get(0);

		this.kubernetesProvider = new KubernetesProvider(this, "kubernetes", {
			host: this.cluster.apiserverUrl,
			clusterCaCertificate: Fn.base64decode(
				this.kubeconfig.clusterCaCertificate,
			),
			token: this.kubeconfig.token,
		});

		// this.helmProvider = new HelmProvider(this, "helm", {
		// 	kubernetes: {
		// 		clusterCaCertificate: this.kubeconfig.clusterCaCertificate,
		// 		host: this.kubeconfig.host,
		// 		token: this.kubeconfig.token,
		// 	},
		// });

		new Deployment(this, "nginx", {
			provider: this.kubernetesProvider,
			metadata: {
				name: "nginx",
				labels: {
					app: "nginx",
				},
			},
			spec: {
				replicas: "1",
				selector: {
					matchLabels: {
						app: "nginx",
					},
				},
				template: {
					metadata: {
						labels: {
							app: "nginx",
						},
					},
					spec: {
						container: [
							{
								name: "nginx",
								image: "nginx",
							},
						],
					},
				},
			},
		});

		this.nodePools.push(
			new K8SPool(this, "primary", {
				name: "primary",
				clusterId: this.cluster.id,
				region: this.cluster.region,
				zone: Zones.AMS1,
				waitForPoolReady: false,
				nodeType: "GP1-XS",
				size: 3,
				autoscaling: false,
				autohealing: true,
				upgradePolicy: {
					maxSurge: 1,
					maxUnavailable: 1,
				},
				containerRuntime: "containerd",
			}),
		);

		this.nodePools.push(
			new K8SPool(this, "secondary", {
				name: "secondary",
				clusterId: this.cluster.id,
				region: this.cluster.region,
				zone: Zones.AMS1,
				waitForPoolReady: false,
				nodeType: "DEV1-M",
				size: 3,
				minSize: 3,
				maxSize: 9,
				autohealing: true,
				autoscaling: true,
				upgradePolicy: {
					maxSurge: 1,
					maxUnavailable: 1,
				},
				containerRuntime: "containerd",
			}),
		);
	}
}

const app = new App();
const stack = new Platform(app, "production");

new CloudBackend(stack, {
	hostname: "app.terraform.io",
	organization: "RawkodeAcademy",
	workspaces: new NamedCloudWorkspace("core-platform"),
});

app.synth();
