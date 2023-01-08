import { Construct } from "constructs";
import { App, CloudBackend, NamedCloudWorkspace, TerraformStack } from "cdktf";
import { GoogleBetaProvider } from "./.gen/providers/google-beta/provider";
import { GoogleProject } from "./.gen/providers/google-beta/google-project";
import { GoogleComputeNetwork } from "./.gen/providers/google-beta/google-compute-network";

class RawkodeCloud extends TerraformStack {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		new CloudBackend(this, {
			hostname: "app.terraform.io",
			organization: "RawkodeAcademy",
			workspaces: new NamedCloudWorkspace("rawkode-cloud"),
		});

		const provider = new GoogleBetaProvider(this, "google", {
			project: "rawkode-academy",
			region: "europe-west2",
		});

		const project = new GoogleProject(this, "cloud", {
			name: `Rawkode Cloud - ${id}`,
			projectId: `rawkode-cloud-${id}1`,
			autoCreateNetwork: false,
			billingAccount: "01B975-72272E-DCA213",
			provider,
		});

		new GoogleComputeNetwork(this, "network", {
			project: project.projectId,
			name: "network",
			autoCreateSubnetworks: true,
			provider,
		});

		// const kubernetesCluster = new GoogleContainerCluster(
		// 	this,
		// 	"rawkode.cloud",
		// 	{
		// 		name: "rawkode.cloud",
		// 		location: "europe-west2",
		// 		monitoringService: "none",
		// 		loggingService: "none",
		// 		releaseChannel: {
		// 			channel: "RAPID",
		// 		},
		// 		removeDefaultNodePool: true,
		// 		verticalPodAutoscaling: {
		// 			enabled: true,
		// 		},
		// 	},
		// );

		// new GoogleContainerNodePool(this, "primary", {
		// 	cluster: kubernetesCluster.name,
		// 	nodeConfig: {
		// 		machineType: "e2-highcpu-8",
		// 		spot: true,
		// 		oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
		// 		diskType: "pd-standard",
		// 		diskSizeGb: 60,
		// 	},
		// 	management: {
		// 		autoRepair: true,
		// 		autoUpgrade: true,
		// 	},
		// 	upgradeSettings: {
		// 		strategy: "SURGE",
		// 		maxSurge: 1,
		// 		maxUnavailable: 0,
		// 	},
		// 	initialNodeCount: 1,
		// 	autoscaling: {
		// 		locationPolicy: "BALANCED",
		// 		minNodeCount: 3,
		// 		maxNodeCount: 9,
		// 	},
		// });
	}
}

const app = new App();
new RawkodeCloud(app, "production");
app.synth();
