import * as pulumi from "@pulumi/pulumi";
import * as doppler from "@pulumiverse/doppler";
import * as gcp from "@pulumi/gcp";
import * as google_native from "@pulumi/google-native";

interface ProjectArgs {
	isPulumiProject: boolean;
	includedPermissions: string[];
}

const createProject = (name: string, args: ProjectArgs) => {
	let includedPermissions = args.includedPermissions;

	if (args.isPulumiProject) {
		includedPermissions = includedPermissions.concat([
			// cloudkms for accessing key for secrets backend
			"cloudkms.cryptoKeys.get",
			"cloudkms.cryptoKeyVersions.useToDecrypt",
			"cloudkms.cryptoKeyVersions.useToEncrypt",
			// storage for state
			"storage.objects.create",
			"storage.objects.get",
			"storage.objects.list",
			// Delete for removing the lockfile
			"storage.objects.delete",
		]);
	}

	const dnsRole = new google_native.iam.v1.Role(name, {
		roleId: `${name}PulumiRole`,
		title: `${name} Role for Pulumi Automation`,
		includedPermissions,
	});

	const dnsServiceAccount = new google_native.iam.v1.ServiceAccount(name, {
		accountId: `${name}PulumiServiceAccount`,
		displayName: `${name} Pulumi ServiceAccount`,
	});

	const dnsBinding = new gcp.projects.IAMMember(name, {
		project: "rawkode-academy",
		member: pulumi.interpolate`serviceAccount:${dnsServiceAccount.email}`,
		role: dnsRole.name,
	});

	const serviceAccountKey = new gcp.serviceaccount.Key(name, {
		serviceAccountId: dnsServiceAccount.email,
		keyAlgorithm: "KEY_ALG_RSA_2048",
		privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
	});

	const dopplerProject = new doppler.Project(
		"project",
		{
			name,
		},
		{
			protect: true,
			deleteBeforeReplace: true,
		},
	);

	const dopplerEnvironment = new doppler.Environment(
		"environment",
		{
			name: "production",
			slug: "production",
			project: dopplerProject.name,
		},
		{
			protect: true,
			deleteBeforeReplace: true,
		},
	);

	const dopplerSecret = new doppler.Secret(
		"secret",
		{
			project: dopplerProject.name,
			config: dopplerEnvironment.slug,
			name: "GOOGLE_CREDENTIALS",
			value: serviceAccountKey.privateKey.apply((key) =>
				Buffer.from(key, "base64").toString("utf-8"),
			),
		},
		{
			deleteBeforeReplace: true,
		},
	);
};

createProject("dns", {
	isPulumiProject: true,
	includedPermissions: [
		"dns.changes.create",
		"dns.managedZones.list",
		"dns.managedZones.get",
		"dns.managedZones.create",
		"dns.managedZones.update",
		"dns.managedZones.delete",
		"dns.resourceRecordSets.list",
		"dns.resourceRecordSets.get",
		"dns.resourceRecordSets.create",
		"dns.resourceRecordSets.update",
		"dns.resourceRecordSets.delete",
	],
});
