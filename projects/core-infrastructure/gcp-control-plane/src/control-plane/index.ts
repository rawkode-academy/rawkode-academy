import * as pulumi from "@pulumi/pulumi";
import { PulumiIntegration } from "./integrations";
import { RawkodeProject } from "./project";

interface Args {
	gcpProject: string;
	gcpRegion: string;
}

export class GcpControlPlane extends pulumi.ComponentResource {
	public readonly gcpProject: string;
	public readonly gcpRegion: string;
	public pulumiIntegration?: PulumiIntegration;

	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("rawkode:ControlPlane", name, {}, opts);

		this.gcpProject = args.gcpProject;
		this.gcpRegion = args.gcpRegion;
	}

	// getPulumiProjectRole(): gcp.projects.IAMCustomRole {
	// 	if (!this.pulumiProjectRole) {
	// 		throw new Error("Pulumi project support has not been enabled.");
	// 	}

	// 	return this.pulumiProjectRole;
	// }

	// getPulumiProjectConditionalRole(): gcp.projects.IAMCustomRole {
	// 	if (!this.pulumiProjectConditionalRole) {
	// 		throw new Error("Pulumi project support has not been enabled.");
	// 	}

	// 	return this.pulumiProjectConditionalRole;
	// }

	isPulumiEnabled(): boolean {
		return this.pulumiIntegration !== undefined;
	}

	getPulumiIntegration(): PulumiIntegration {
		if (!this.pulumiIntegration) {
			throw new Error("PulumiIntegration not enabled");
		}

		return this.pulumiIntegration;
	}

	enablePulumiIntegration() {
		if (this.pulumiIntegration) {
			throw new Error("Pulumi project support has already been enabled.");
		}

		this.pulumiIntegration = new PulumiIntegration(this);

		// this.pulumiProjectRole = new gcp.projects.IAMCustomRole(
		// 	"pulumi-project-role",
		// 	{
		// 		title: "Pulumi Project Role",
		// 		roleId: "pulumi-project-role".replace(/-/g, "."),
		// 		description: "Pulumi Project Role for Rawkode Academy Projects",
		// 		project: this.gcpProject,
		// 		permissions: [
		// 			// Secrets Manager for getting and storing secrets
		// 			,
		// 			// Storage for state
		// 			"storage.objects.create",
		// 		],
		// 	},
		// 	{
		// 		parent: this,
		// 	},
		// );

		// this.pulumiProjectConditionalRole = new gcp.projects.IAMCustomRole(
		// 	"pulumi-project-conditional-role",
		// 	{
		// 		title: "Pulumi Project Conditional Role",
		// 		roleId: "pulumi-project-conditional-role".replace(/-/g, "."),
		// 		description:
		// 			"Pulumi Project Conditional Role for Rawkode Academy Projects",
		// 		project: this.gcpProject,
		// 		permissions: [
		// 			// Secrets Manager for getting and storing secrets

		// 			// Storage for state
		// 			"storage.objects.get",
		// 			// Delete for removing the lockfile
		// 			"storage.objects.delete",
		// 			// CloudKMS for Secrets Backend
		// 			"cloudkms.cryptoKeys.get",
		// 			"cloudkms.cryptoKeyVersions.useToDecrypt",
		// 			"cloudkms.cryptoKeyVersions.useToEncrypt",
		// 		],
		// 	},
		// 	{
		// 		parent: this,
		// 	},
		// );
	}

	createProject(name: string): RawkodeProject {
		return new RawkodeProject(
			name,
			{
				controlPlane: this,
			},
			{
				parent: this,
			},
		);
	}
}
