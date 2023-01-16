import { Construct } from "constructs";
import { Zone } from "@generatedProviders/cloudflare/zone";
import { Record } from "../../.gen/providers/cloudflare/record";
import { Nameservers } from "../../.gen/providers/gandi/nameservers";

enum Email {
	Unset,
	Configured,
	Discouraged,
}

export enum Account {
	Academy = "0aeb879de8e3cdde5fb3d413025222ce",
}

export class ManagedDomain extends Construct {
	private readonly cloudflareZone: Zone;
	private email: Email = Email.Unset;

	constructor(scope: Construct, zone: string, accountId: Account) {
		super(scope, zone);

		this.cloudflareZone = new Zone(this, "zone", {
			zone,
			accountId,
		});

		new Nameservers(this, "nameservers", {
			domain: zone,
			nameservers: this.cloudflareZone.nameServers,
		});
	}

	addARecord(name: string, value: string): ManagedDomain {
		new Record(this, `a-${name}`, {
			zoneId: this.cloudflareZone.id,
			type: "A",
			ttl: 300,
			name,
			value,
		});

		return this;
	}

	addCNameRecord(name: string, value: string): ManagedDomain {
		new Record(this, `cname-${name}`, {
			zoneId: this.cloudflareZone.id,
			type: "CNAME",
			ttl: 300,
			name,
			value,
		});

		return this;
	}

	addTextRecord(name: string, value: string): ManagedDomain {
		new Record(this, `txt-${name}`, {
			zoneId: this.cloudflareZone.id,
			type: "TXT",
			ttl: 300,
			name,
			value,
		});

		return this;
	}

	discourageEmail(): ManagedDomain {
		switch (this.email) {
			case Email.Discouraged:
				return this;

			case Email.Unset:
				this.email = Email.Discouraged;

				new Record(this, "mx", {
					zoneId: this.cloudflareZone.id,
					name: "@",
					type: "TXT",
					ttl: 300,
					value: '"v=spf1 ~all"',
				});

				return this;

			case Email.Configured:
				throw new Error(
					"Attempting to discourage email, but email has already been enabled",
				);
		}
	}

	enableFastmail(): ManagedDomain {
		new Record(this, "mx1", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 10,
			value: "in1-smtp.messagingengine.com.",
		});

		new Record(this, "mx2", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 20,
			value: "in2-smtp.messagingengine.com.",
		});

		return this;
	}

	enableGSuite(): ManagedDomain {
		new Record(this, "mx1", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 1,
			value: "aspmx.l.google.com.",
		});

		new Record(this, "mx2", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 5,
			value: "alt1.aspmx.l.google.com.",
		});

		new Record(this, "mx3", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 5,
			value: "alt2.aspmx.l.google.com.",
		});

		new Record(this, "mx4", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 10,
			value: "alt3.aspmx.l.google.com.",
		});

		new Record(this, "mx5", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 10,
			value: "alt4.aspmx.l.google.com.",
		});
		return this;
	}

	setupRebrandly(subdomain: string): ManagedDomain {
		new Record(this, "rebrandly", {
			zoneId: this.cloudflareZone.id,
			name: subdomain,
			type: "A",
			ttl: 3600,
			priority: 10,
			value: "52.72.49.79",
		});

		return this;
	}

	setupShortIO(subdomain: string): ManagedDomain {
		new Record(this, "shortio1", {
			zoneId: this.cloudflareZone.id,
			name: subdomain,
			type: "A",
			ttl: 3600,
			priority: 10,
			value: "52.21.33.16",
		});

		new Record(this, "shortio2", {
			zoneId: this.cloudflareZone.id,
			name: subdomain,
			type: "A",
			ttl: 3600,
			priority: 10,
			value: "52.59.165.42",
		});

		return this;
	}
}
