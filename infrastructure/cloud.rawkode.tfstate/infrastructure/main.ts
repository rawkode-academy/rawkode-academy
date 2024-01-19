import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { R2Bucket } from "./.gen/providers/cloudflare/r2-bucket";

class CloudflareWorker extends TerraformStack {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		new R2Bucket(this, "terraform-state-storage", {
			accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
			name: "rawkode-academy-terraform-state",
		});
	}
}

const app = new App();

new CloudflareWorker(app, "infrastructure");

app.synth();
