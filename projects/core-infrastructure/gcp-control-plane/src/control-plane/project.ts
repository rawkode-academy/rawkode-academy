import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { GcpControlPlane } from "./index";
import { local } from "@pulumi/command";

interface ProjectArgs {
	controlPlane: GcpControlPlane;
}

export class RawkodeProject extends pulumi.ComponentResource {
	private readonly name: string;
	private readonly resourceOptions: pulumi.CustomResourceOptions;
	private readonly controlPlane: GcpControlPlane;
	private readonly serviceAccount: gcp.serviceaccount.Account;
	private accessKey?: gcp.serviceaccount.Key;
	private kmsKey?: gcp.kms.CryptoKey;
	private pulumiKmsRoleBinding?: gcp.projects.IAMBinding;
	private pulumiStorageListRoleBinding?: gcp.projects.IAMBinding;
	private pulumiStorageAccessRoleBinding?: gcp.projects.IAMBinding;
	private opKey?: local.Command;

	constructor(
		name: string,
		args: ProjectArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("rawkode:project", name, {}, opts);

		this.name = name;
		this.controlPlane = args.controlPlane;
		this.resourceOptions = {
			parent: this,
			deleteBeforeReplace: true,
		};

		this.serviceAccount = new gcp.serviceaccount.Account(
			name,
			{
				project: this.controlPlane.gcpProject,
				accountId: name,
				displayName: name,
			},
			this.resourceOptions,
		);
	}

	vaultName(): string {
		return `sa.${this.name.replace(/-/g, ".")}`;
	}

	createAccessKey(): this {
		this.accessKey = new gcp.serviceaccount.Key(
			this.name,
			{
				serviceAccountId: this.serviceAccount.id,
			},
			this.resourceOptions,
		);

		this.accessKey.privateKey.apply((base64Key) => {
			const jsonKey = Buffer.from(base64Key, "base64").toString("utf-8");

			this.opKey = new local.Command(
				`${this.name}-op-key`,
				{
					create: pulumi.interpolate`op item create --category=password --title "pulumi-google-credentials" --vault="${this.vaultName()}" password='${jsonKey}'`,
					delete: pulumi.interpolate`op item delete --vault="${this.vaultName()}" "pulumi-google-credentials"`,
					triggers: [base64Key],
				},
				{
					...this.resourceOptions,
					replaceOnChanges: ["*"],
				},
			);
		});

		return this;
	}

	enablePulumiSupport(): this {
		if (!this.controlPlane.isPulumiEnabled()) {
			throw new Error(
				"Pulumi support has not been enabled on the control plane.",
			);
		}

		const pulumiIntegration = this.controlPlane.getPulumiIntegration();

		this.kmsKey = new gcp.kms.CryptoKey(
			this.name,
			{
				name: this.name,
				keyRing: pulumiIntegration.kmsKeyring.id,
				rotationPeriod: "2592000s", // 30 days
				purpose: "ENCRYPT_DECRYPT",
			},
			this.resourceOptions,
		);

		this.pulumiStorageListRoleBinding = new gcp.projects.IAMBinding(
			`${this.name}-pulumi-storage-list`,
			{
				project: this.controlPlane.gcpProject,
				members: [
					pulumi.interpolate`serviceAccount:${this.serviceAccount.email}`,
				],
				role: pulumiIntegration.storageListRole.id,
			},
			this.resourceOptions,
		);

		this.pulumiStorageAccessRoleBinding = new gcp.projects.IAMBinding(
			`${this.name}-pulumi-storage-access`,
			{
				project: this.controlPlane.gcpProject,
				members: [
					pulumi.interpolate`serviceAccount:${this.serviceAccount.email}`,
				],
				role: pulumiIntegration.storageAccessRole.id,
				condition: {
					title: "only-access-own-state-file",
					description: "Only allow access it's own state file",
					expression: pulumi.interpolate`resource.name.startsWith("projects/_/buckets/${pulumiIntegration.bucket.name}/objects/${this.name}/")`,
				},
			},
			this.resourceOptions,
		);

		this.pulumiKmsRoleBinding = new gcp.projects.IAMBinding(
			`${this.name}-pulumi-kms`,
			{
				project: this.controlPlane.gcpProject,
				members: [
					pulumi.interpolate`serviceAccount:${this.serviceAccount.email}`,
				],
				role: pulumiIntegration.kmsAccessRole.id,
				condition: {
					title: "only-use-own-key",
					description: "Only allow access to the project key",
					expression: pulumi.interpolate`resource.name == "projects/${this.controlPlane.gcpProject}/locations/${this.controlPlane.gcpRegion}/keyRings/${pulumiIntegration.kmsKeyring.name}/cryptoKeys/${this.kmsKey.name}"`,
				},
			},
			this.resourceOptions,
		);

		return this;
	}
}
