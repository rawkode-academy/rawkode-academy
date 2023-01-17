import { Construct } from "constructs";
import { App, TerraformStack, CloudBackend, NamedCloudWorkspace } from "cdktf";
import { ScalewayProvider } from "@generatedProviders/scaleway/provider";
import { AccountProject } from "@generatedProviders/scaleway/account-project";

class Platform extends TerraformStack {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		new ScalewayProvider(this, "scaleway", {
			organizationId: "b07462e9-1a00-43b4-a6a8-6e3004a31984",
		});

		new AccountProject(this, "project", {
			name: `platform-${id}`,
			description: `${id} platform for Rawkode Academy's Core Infrastructure`,
		});
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
