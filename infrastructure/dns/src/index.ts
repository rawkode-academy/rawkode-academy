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
			apiToken: process.env.CLOUDFLARE_API_TOKEN,
		});

		new DnsimpleProvider(this, "dnsimple", {
			account: process.env.DNSIMPLE_ACCOUNT || "",
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

const baseUrl = "https://terraform-state-backend.rawkode-academy.workers.dev";

new HttpBackend(stack, {
	address: `${baseUrl}/states/core-infrastructure-dns`,
	lockMethod: "PUT",
	unlockMethod: "DELETE",
	lockAddress: `${baseUrl}/states/core-infrastructure-dns/lock`,
	unlockAddress: `${baseUrl}/states/core-infrastructure-dns/lock`,
	username: "rawkodeacademy",
});

app.synth();
