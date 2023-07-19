import { App, Fn, HttpBackend, TerraformStack } from "cdktf";
import { AppServiceCertificateBinding } from "./.gen/providers/azurerm/app-service-certificate-binding";
import { AppServiceCustomHostnameBinding } from "./.gen/providers/azurerm/app-service-custom-hostname-binding";
import { AppServiceManagedCertificate } from "./.gen/providers/azurerm/app-service-managed-certificate";
import { CosmosdbAccount } from "./.gen/providers/azurerm/cosmosdb-account";
import { CosmosdbMongoDatabase } from "./.gen/providers/azurerm/cosmosdb-mongo-database";
import { DataAzurermClientConfig } from "./.gen/providers/azurerm/data-azurerm-client-config";
import { KeyVault } from "./.gen/providers/azurerm/key-vault";
import { KeyVaultAccessPolicyA } from "./.gen/providers/azurerm/key-vault-access-policy";
import { KeyVaultSecret } from "./.gen/providers/azurerm/key-vault-secret";
import { LinuxWebApp } from "./.gen/providers/azurerm/linux-web-app";
import { AzurermProvider } from "./.gen/providers/azurerm/provider";
import { ResourceGroup } from "./.gen/providers/azurerm/resource-group";
import { ServicePlan } from "./.gen/providers/azurerm/service-plan";
import { DataCloudflareZone } from "./.gen/providers/cloudflare/data-cloudflare-zone";
import { CloudflareProvider } from "./.gen/providers/cloudflare/provider";
import { Record } from "./.gen/providers/cloudflare/record";
import { Password } from "./.gen/providers/random/password";
import { RandomProvider } from "./.gen/providers/random/provider";

const terraformBackendUrl = `${
	process.env.TERRAFORM_BACKEND_URL || ""
}/states/cms.rawkode.academy`;

class MyStack extends TerraformStack {
	constructor(scope: App, name: string) {
		super(scope, name);

		new AzurermProvider(this, "azure", {
			features: {},
		});

		new CloudflareProvider(this, "cloudflare", {});

		const cloudflareZone = new DataCloudflareZone(this, "cloudflare-zone", {
			name: "rawkode.academy",
		});

		new RandomProvider(this, "random", {});

		const azureClientConfig = new DataAzurermClientConfig(
			this,
			"azure-client-config",
			{},
		);

		const resourceGroup = new ResourceGroup(this, "resource-group", {
			name: "cms.rawkode.academy",
			location: "West Europe",
		});

		const servicePlan = new ServicePlan(this, "service-plan", {
			name: "rawkode-academy-cms",
			resourceGroupName: resourceGroup.name,
			location: resourceGroup.location,
			osType: "Linux",
			skuName: "B1",
		});

		const keyVault = new KeyVault(this, "key-vault", {
			name: "rawkode-academy-cms",
			location: resourceGroup.location,
			resourceGroupName: resourceGroup.name,
			skuName: "standard",
			tenantId: azureClientConfig.tenantId,
		});

    new KeyVaultAccessPolicyA(this, "self-key-vault-access-policy", {
      keyVaultId: keyVault.id,
      tenantId: azureClientConfig.tenantId,
      objectId: azureClientConfig.objectId,
      keyPermissions: ["Get"],
      secretPermissions: ["Get", "List", "Set", "Delete", "Purge"],
    });

		const cosmosDbAccount = new CosmosdbAccount(this, "cosmosdb-account", {
			name: "rawkode-academy-cms",
			resourceGroupName: resourceGroup.name,
			location: resourceGroup.location,
			offerType: "Standard",
			kind: "MongoDB",
			enableAutomaticFailover: false,
			consistencyPolicy: {
				consistencyLevel: "BoundedStaleness",
				maxIntervalInSeconds: 300,
				maxStalenessPrefix: 10000,
			},
			geoLocation: [
				{
					location: resourceGroup.location,
					failoverPriority: 0,
				},
			],
		});

		new CosmosdbMongoDatabase(this, "cosmosdb-mongo-database", {
			name: "rawkode-academy-cms",
			resourceGroupName: resourceGroup.name,
			accountName: cosmosDbAccount.name,
			throughput: 400,
		});

		const payloadSecret = new Password(this, "payload-secret", {
			length: 32,
			special: true,
			minSpecial: 4,
			upper: true,
			minUpper: 4,
			lower: true,
			minLower: 4,
			numeric: true,
			minNumeric: 4,
		});

		const azurePayloadSecret = new KeyVaultSecret(
			this,
			"azure-payload-secret",
			{
				keyVaultId: keyVault.id,
				name: "payload-secret",
				value: payloadSecret.result,
			},
		);

		const azureGitHubClientSecret = new KeyVaultSecret(
			this,
			"azure-github-client-secret",
			{
				keyVaultId: keyVault.id,
				name: "github-client-secret",
				value: process.env.APPSETTING_GITHUB_CLIENT_SECRET || "",
			},
		);

		const linuxWebApp = new LinuxWebApp(this, "linux-web-app", {
			name: "rawkode-academy-cms",
			enabled: true,
			servicePlanId: servicePlan.id,
			location: resourceGroup.location,
			resourceGroupName: resourceGroup.name,
			httpsOnly: true,
			identity: {
				type: "SystemAssigned",
			},
			siteConfig: {
				alwaysOn: true,
				applicationStack: {
					dockerRegistryUrl: "https://ghcr.io",
					dockerImageName: "rawkodeacademy/cms",
				},
			},
			appSettings: {
				WEBSITES_PORT: "3000",
        DNS_NAME: "https://cms.rawkode.academy",
				MONGODB_URI: Fn.element(cosmosDbAccount.connectionStrings, 0),
				OAUTH_BASE_URL: process.env.APPSETTING_OAUTH_BASE_URL || "",
				OAUTH_CLIENT_ID: process.env.APPSETTING_OAUTH_CLIENT_ID || "",
				OAUTH_CLIENT_SECRET: `@Microsoft.KeyVault(SecretUri=${azureGitHubClientSecret.versionlessId})`,
				PAYLOAD_SECRET: `@Microsoft.KeyVault(SecretUri=${azurePayloadSecret.versionlessId})`,
			},
		});

		const domainVerification = new Record(
			this,
			"cloudflare-record-verification",
			{
				zoneId: cloudflareZone.id,
				name: "asuid.cms.rawkode.academy",
				type: "TXT",
				value: linuxWebApp.customDomainVerificationId,
				ttl: 300,
				proxied: false,
				comment: "Managed by Terraform",
			},
		);

		const dnsRecord = new Record(this, "cloudflare-record", {
			zoneId: cloudflareZone.id,
			name: "cms",
			type: "CNAME",
			value: linuxWebApp.defaultHostname,
			ttl: 300,
			proxied: false,
			comment: "Managed by Terraform",
		});

		const hostnameBinding = new AppServiceCustomHostnameBinding(
			this,
			"app-service-custom-hostname-binding",
			{
				hostname: dnsRecord.hostname,
				appServiceName: linuxWebApp.name,
				resourceGroupName: resourceGroup.name,
				timeouts: {
					create: "10m",
				},
				dependsOn: [domainVerification],
			},
		);

		const appServiceCertificate = new AppServiceManagedCertificate(
			this,
			"app-service-managed-certificate",
			{
				customHostnameBindingId: hostnameBinding.id,
			},
		);

		new AppServiceCertificateBinding(this, "app-service-certificate-binding", {
			hostnameBindingId: hostnameBinding.id,
			sslState: "SniEnabled",
			certificateId: appServiceCertificate.id,
		});

		new KeyVaultAccessPolicyA(this, "key-vault-access-policy", {
			keyVaultId: keyVault.id,
			tenantId: azureClientConfig.tenantId,
			objectId: linuxWebApp.identity.principalId,
			secretPermissions: ["Get"],
		});
	}
}

const app = new App();

const stack = new MyStack(app, "deploy");

new HttpBackend(stack, {
	address: terraformBackendUrl,
	username: "rawkodeacademy",
	lockMethod: "PUT",
	lockAddress: `${terraformBackendUrl}/lock`,
	unlockMethod: "DELETE",
	unlockAddress: `${terraformBackendUrl}/lock`,
});

app.synth();
