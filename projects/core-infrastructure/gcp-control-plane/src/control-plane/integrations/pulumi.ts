import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import type { GcpControlPlane } from "..";

export class PulumiIntegration extends pulumi.ComponentResource {
	public readonly bucket: gcp.storage.Bucket;
	public readonly kmsKeyring: gcp.kms.KeyRing;
	public readonly kmsAccessRole: gcp.projects.IAMCustomRole;
	public readonly storageListRole: gcp.projects.IAMCustomRole;
	public readonly storageAccessRole: gcp.projects.IAMCustomRole;
	private readonly resourceOptions: pulumi.CustomResourceOptions;

	constructor(gcpControlPlane: GcpControlPlane) {
		super(
			"rawkode:ControlPlane:PulumiIntegration",
			"pulumi",
			{},
			{
				parent: gcpControlPlane,
			},
		);

		this.resourceOptions = {
			parent: this,
			deleteBeforeReplace: true,
		};

		this.bucket = new gcp.storage.Bucket(
			"pulumi",
			{
				name: "gcp-control-plane-pulumi",
				location: gcpControlPlane.gcpRegion,
			},
			this.resourceOptions,
		);

		this.kmsKeyring = new gcp.kms.KeyRing(
			"pulumi",
			{
				name: "gcp-control-plane-pulumi",
				project: gcpControlPlane.gcpProject,
				location: gcpControlPlane.gcpRegion,
			},
			this.resourceOptions,
		);

		this.kmsAccessRole = new gcp.projects.IAMCustomRole(
			"pulumi-kms",
			{
				title: "Pulumi KMS Access",
				roleId: "pulumi.kms.access",
				description: "Pulumi access to KMS for encrypting secrets",
				project: gcpControlPlane.gcpProject,
				permissions: [
					"cloudkms.cryptoKeys.get",
					"cloudkms.cryptoKeyVersions.useToDecrypt",
					"cloudkms.cryptoKeyVersions.useToEncrypt",
				],
			},
			this.resourceOptions,
		);

		this.storageListRole = new gcp.projects.IAMCustomRole(
			"pulumi-storage-list",
			{
				title: "Pulumi Storage List",
				roleId: "pulumi.storage.list",
				description: "Pulumi role for listing storage buckets",
				project: gcpControlPlane.gcpProject,
				permissions: ["storage.objects.list"],
			},
			this.resourceOptions,
		);

		this.storageAccessRole = new gcp.projects.IAMCustomRole(
			"pulumi-storage-access",
			{
				title: "Pulumi Storage Access",
				roleId: "pulumi.storage.access",
				description: "Pulumi access to storage for encrypting secrets",
				project: gcpControlPlane.gcpProject,
				permissions: [
					"storage.objects.get",
					"storage.objects.create",
					"storage.objects.update",
					"storage.objects.delete",
				],
			},
			this.resourceOptions,
		);
	}
}
