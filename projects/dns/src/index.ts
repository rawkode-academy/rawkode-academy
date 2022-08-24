import { Construct } from "constructs";
import { App, TerraformStack, RemoteBackend } from "cdktf";
import {
  CloudflareProvider,
  Record,
  Zone,
  ZoneSettingsOverride,
} from "@cdktf/provider-cloudflare";

import { Domains } from "./domains";

const app = new App();

class DnsManagement extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const provider = new CloudflareProvider(this, "cloudflare");

    Domains.map((domain) => {
      const zone = new Zone(this, domain.name, {
        zone: domain.domain,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        type: "full",
        plan: "free",
        paused: false,
        jumpStart: false,
        provider,
      });

      new ZoneSettingsOverride(this, `${domain.name}-settings`, {
        zoneId: zone.id,
        settings: {
          alwaysUseHttps: "on",
          automaticHttpsRewrites: "on",
          ssl: "strict",
          minTlsVersion: "1.2",
          universalSsl: "on",
        },
      });

      Object.keys(domain.records).map((key) => {
        const record = domain.records[key];

        new Record(this, `${domain.name}-${key}`, {
          zoneId: zone.id,
          ...record,
        });
      });
    });
  }
}

const stack = new DnsManagement(app, "production");

new RemoteBackend(stack, {
  hostname: "app.terraform.io",
  organization: "RawkodeAcademy",
  workspaces: {
    name: "dns",
  },
});

app.synth();
