import { CloudflareProvider } from "@generatedProviders/cloudflare/provider";
import { GandiProvider } from "@generatedProviders/gandi/provider";
import { App, CloudBackend, NamedCloudWorkspace, TerraformStack } from "cdktf";
import { Construct } from "constructs";

import fbomDev from "./domains/fbom.dev";
import fbomLive from "./domains/fbom.live";
import klusteredLive from "./domains/klustered.live";
import rawkoDe from "./domains/rawko.de";
import rawkodeAcademy from "./domains/rawkode.academy";
import rawkodeChat from "./domains/rawkode.chat";
import rawkodeCloud from "./domains/rawkode.cloud";
import rawkodeStudio from "./domains/rawkode.studio";
import rawkodeCommunity from "./domains/rawkode.community";
import rawkodeLink from "./domains/rawkode.link";
import rawkodeNews from "./domains/rawkode.news";

class CoreDns extends TerraformStack {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		new CloudflareProvider(this, "cloudflare");

		new GandiProvider(this, "gandi", {
			key: process.env.GANDI_KEY || "",
		});

		fbomDev(this);
		fbomLive(this);
		klusteredLive(this);
		rawkoDe(this);
		rawkodeAcademy(this);
		rawkodeChat(this);
		rawkodeCloud(this);
		rawkodeCommunity(this);
		rawkodeLink(this);
		rawkodeNews(this);
		rawkodeStudio(this);
	}
}

const app = new App();
const stack = new CoreDns(app, "dns");

new CloudBackend(stack, {
	hostname: "app.terraform.io",
	organization: "RawkodeAcademy",
	workspaces: new NamedCloudWorkspace("core-dns"),
});

app.synth();
