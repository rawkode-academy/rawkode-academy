import { Construct } from "constructs";
import { App, TerraformStack, CloudBackend, NamedCloudWorkspace } from "cdktf";
import { GoogleBetaProvider } from "@cdktf/provider-google-beta/lib/provider";

class GoogleCloudPlatform extends TerraformStack {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		new GoogleBetaProvider(this, "gcp", {
			project: "rawkode-academy",
			region: "europe-west2",
		});
	}
}

const app = new App();
const stack = new GoogleCloudPlatform(app, "gcp-control-plane");

new CloudBackend(stack, {
	hostname: "app.terraform.io",
	organization: "RawkodeAcademy",
	workspaces: new NamedCloudWorkspace("gcp-control-plane"),
});

app.synth();
