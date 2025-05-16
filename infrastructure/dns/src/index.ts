import { CloudflareProvider } from "@generatedProviders/cloudflare/provider";
import { DnsimpleProvider } from "@generatedProviders/dnsimple/provider";
import { App, HttpBackend, TerraformStack } from "cdktf";
import { Construct } from "constructs";

import alphabitsFm from "./domains/alphabits.fm";
import alphabitsShow from "./domains/alphabits.show";
import alphabitsTv from "./domains/alphabits.tv";
import chappaaiDev from "./domains/chappaai.dev";
import cloudnativecompassFm from "./domains/cloudnativecompass.fm";
import klusteredLive from "./domains/klustered.live";
import rawkoDe from "./domains/rawko.de";
import rawkodeAcademy from "./domains/rawkode.academy";
import rawkodeBlog from "./domains/rawkode.blog";
import rawkodeChat from "./domains/rawkode.chat";
import rawkodeCloud from "./domains/rawkode.cloud";
import rawkodeCom from "./domains/rawkode.com";
import rawkodeCommunity from "./domains/rawkode.community";
import rawkodeDev from "./domains/rawkode.dev";
import rawkodeEmail from "./domains/rawkode.email";
import rawkodeLink from "./domains/rawkode.link";
import rawkodeLive from "./domains/rawkode.live";
import rawkodeNews from "./domains/rawkode.news";
import rawkodeSocial from "./domains/rawkode.social";
import rawkodeStudio from "./domains/rawkode.studio";
import rawkodeWin from "./domains/rawkode.win";
import rawkodeVip from "./domains/rawkode.vip";
import rawkodeXyz from "./domains/rawkode.xyz";
import rmrfEmail from "./domains/rmrf.email";

class CoreDns extends TerraformStack {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		new CloudflareProvider(this, "cloudflare", {
			accountId: "0aeb879de8e3cdde5fb3d413025222ce",
			apiToken: process.env.CLOUDFLARE_TOKEN,
		});

		new DnsimpleProvider(this, "dnsimple", {
			account: "126046",
			token: process.env.DNSIMPLE_TOKEN || "",
		});

		alphabitsFm(this);
		alphabitsShow(this);
		alphabitsTv(this);
		chappaaiDev(this);
		cloudnativecompassFm(this);
		klusteredLive(this);
		rawkoDe(this);
		rawkodeAcademy(this);
		rawkodeBlog(this);
		rawkodeChat(this);
		rawkodeCloud(this);
		rawkodeCom(this);
		rawkodeCommunity(this);
		rawkodeDev(this);
		rawkodeEmail(this);
		rawkodeLink(this);
		rawkodeLive(this);
		rawkodeNews(this);
		rawkodeSocial(this);
		rawkodeStudio(this);
		rawkodeWin(this);
		rawkodeVip(this);
		rawkodeXyz(this);
		rmrfEmail(this);
	}
}

const app = new App();
const stack = new CoreDns(app, "dns");

const address = "https://code.rawkode.academy/api/v4/projects/1/terraform/state/infrastructure-dns";

new HttpBackend(stack, {
	address,
	retryWaitMin: 5,
	lockAddress: `${address}/lock`,
	lockMethod: "PUT",
	unlockAddress: `${address}/lock`,
	unlockMethod: "DELETE",
});

app.synth();
