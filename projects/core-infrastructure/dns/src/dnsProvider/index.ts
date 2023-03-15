import { Construct } from "constructs";
import { Zone } from "@generatedProviders/cloudflare/zone";
import { ZoneDnssec } from "@generatedProviders/cloudflare/zone-dnssec";
import { Record } from "../../.gen/providers/cloudflare/record";
import { Nameservers } from "../../.gen/providers/gandi/nameservers";

enum Email {
	Unset,
	Configured,
	Discouraged,
}

export enum Registrar {
	Cloudflare,
	Gandi,
}

interface GSuiteConfig {
	domainKey: string;
	spfIncludes: string[];
}

export class ManagedDomain extends Construct {
	private readonly cloudflareZone: Zone;
	private email: Email = Email.Unset;

	constructor(scope: Construct, zone: string, registrar: Registrar) {
		super(scope, zone);

		this.cloudflareZone = new Zone(this, "zone", {
			zone,
		});

		switch (registrar) {
			case Registrar.Cloudflare:
				new ZoneDnssec(this, "dnssec", {
					zoneId: this.cloudflareZone.id,
				});
				break;

			case Registrar.Gandi:
				new Nameservers(this, "nameservers", {
					domain: zone,
					nameservers: this.cloudflareZone.nameServers,
				});
				break;
		}
	}

	addARecord(id: string, name: string, value: string): ManagedDomain {
		new Record(this, id, {
			zoneId: this.cloudflareZone.id,
			type: "A",
			ttl: 300,
			name,
			value,
		});

		return this;
	}

	addCNameRecord(id: string, name: string, value: string): ManagedDomain {
		new Record(this, id, {
			zoneId: this.cloudflareZone.id,
			type: "CNAME",
			ttl: 300,
			name,
			value,
		});

		return this;
	}

	addTextRecord(id: string, name: string, value: string): ManagedDomain {
		new Record(this, id, {
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
				this.addTextRecord("discourage-email", "@", '"v=spf1 ~all"');
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

		this.addTextRecord(
			"spf",
			"@",
			'"v=spf1 include:spf.messagingengine.com ~all"',
		);

		for (let i = 1; i <= 3; i++) {
			this.addCNameRecord(
				`dkim${i}`,
				`fm${i}._domainkey`,
				`fm${i}.${this.cloudflareZone.zone}.dkim.fmhosted.com`,
			);
		}

		new Record(this, "srv-submission", {
			zoneId: this.cloudflareZone.id,
			name: "_submission._tcp",
			type: "SRV",
			ttl: 3600,
			value: "0 1 587 smtp.fastmail.com",
		});

		new Record(this, "srv-imap", {
			zoneId: this.cloudflareZone.id,
			name: "_imap._tcp",
			type: "SRV",
			ttl: 3600,
			value: "0 0 0 .",
		});

		new Record(this, "srv-imaps", {
			zoneId: this.cloudflareZone.id,
			name: "_imaps._tcp",
			type: "SRV",
			ttl: 3600,
			value: "0 0 0 imap.fastmail.com",
		});

		new Record(this, "srv-jmap", {
			zoneId: this.cloudflareZone.id,
			name: "_jmap._tcp",
			type: "SRV",
			ttl: 3600,
			value: "0 1 443 api.fastmail.com",
		});

		return this;
	}

	enableGSuite(config: GSuiteConfig): ManagedDomain {
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

		this.addTextRecord(
			"dkim",
			"google._domainkey",
			`"v=DKIM1; k=rsa; p=${config.domainKey}"`,
		);

		this.addTextRecord(
			"spf",
			"@",
			`"v=spf1 include:_spf.google.com ${config.spfIncludes
				.map((include) => `include:${include}`)
				.join(" ")} ~all"`,
		);

		return this;
	}

	setupRebrandly(subdomain: string): ManagedDomain {
		this.addARecord("rebrandly", subdomain, "52.72.49.79");

		return this;
	}

	setupShortIO(subdomain: string): ManagedDomain {
		this.addARecord("shortio1", subdomain, "52.21.33.16");
		this.addARecord("shortio2", subdomain, "52.59.165.42");

		return this;
	}
}
