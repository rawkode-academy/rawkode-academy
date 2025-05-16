import {
	PageRule,
	type PageRuleActions,
} from "@generatedProviders/cloudflare/page-rule";
import { Record } from "@generatedProviders/cloudflare/record";
import { Zone } from "@generatedProviders/cloudflare/zone";
import { ZoneDnssec } from "@generatedProviders/cloudflare/zone-dnssec";
import { ZoneSettingsOverride } from "@generatedProviders/cloudflare/zone-settings-override";
import { DomainDelegation } from "@generatedProviders/dnsimple/domain-delegation";
import { Construct } from "constructs";

// biome-ignore lint/style/useEnumInitializers: <explanation>
enum Email {
	Unset,
	Configured,
	Discouraged,
}

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum Registrar {
	Cloudflare,
	DnsSimple,
	Gandi,
	Dynadot,
}

interface GSuiteConfig {
	domainKey: string;
	spfIncludes?: string[];
}

interface Microsoft365Config {
	txtVerification?: string;
}

interface ProtonMailConfig {
	verificationCode: string;
}

interface ResendConfig {
	subdomain: string;
	mxValue: string;
	domainKey: string;
}

export class ManagedDomain extends Construct {
	private readonly registrar: Registrar;
	private readonly cloudflareZone: Zone;
	private readonly zoneString: string;
	private email: Email = Email.Unset;

	constructor(scope: Construct, zone: string, registrar: Registrar) {
		super(scope, zone);

		this.zoneString = zone;
		this.registrar = registrar;

		this.cloudflareZone = new Zone(this, "zone", {
			zone,
			accountId: "0aeb879de8e3cdde5fb3d413025222ce",
			type: "full",
			lifecycle: {
				preventDestroy: true,
			},
		});

		new ZoneSettingsOverride(this, "zone-settings", {
			zoneId: this.cloudflareZone.id,
			settings: {
				cnameFlattening: "flatten_at_root",
				alwaysUseHttps: "on",
				automaticHttpsRewrites: "on",
				opportunisticEncryption: "on",
				minTlsVersion: "1.2",
				tls13: "on",
				ssl: "flexible",
				universalSsl: "on",
			},
		});

		switch (registrar) {
			case Registrar.Cloudflare:
				new ZoneDnssec(this, "dnssec", {
					zoneId: this.cloudflareZone.id,
				});
				break;

			case Registrar.DnsSimple:
				new DomainDelegation(this, "delegation", {
					domain: zone,
					nameServers: this.cloudflareZone.nameServers,
				});
				break;
		}
	}

	addPageRule(
		id: string,
		target: string,
		actions: PageRuleActions,
	): ManagedDomain {
		if (this.registrar !== Registrar.Cloudflare) {
			throw new Error("Page rules are only supported for Cloudflare domains");
		}

		new PageRule(this, id, {
			zoneId: this.cloudflareZone.id,
			target,
			actions,
		});

		return this;
	}

	addARecord(
		id: string,
		name: string,
		value: string,
		ttl = 300,
	): ManagedDomain {
		new Record(this, id, {
			zoneId: this.cloudflareZone.id,
			type: "A",
			ttl,
			name,
			value,
			comment: "Managed by Terraform",
		});

		return this;
	}

	addCNameRecord(
		id: string,
		name: string,
		value: string,
		proxied?: boolean,
	): ManagedDomain {
		new Record(this, id, {
			zoneId: this.cloudflareZone.id,
			type: "CNAME",
			name,
			value,
			proxied: proxied || false,
			comment: "Managed by Terraform",
		});

		return this;
	}

	addTextRecord(id: string, name: string, value: string): ManagedDomain {
		new Record(this, id, {
			zoneId: this.cloudflareZone.id,
			type: "TXT",
			name,
			value: `"${value}"`,
			comment: "Managed by Terraform",
		});

		return this;
	}

	discourageEmail(): ManagedDomain {
		switch (this.email) {
			case Email.Discouraged:
				return this;

			case Email.Unset:
				this.email = Email.Discouraged;
				this.addTextRecord("discourage-email", "@", "v=spf1 ~all");
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
			priority: 1,
			value: "in1-smtp.messagingengine.com.",
			comment: "Managed by Terraform",
		});

		new Record(this, "mx2", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 5,
			value: "in2-smtp.messagingengine.com.",
			comment: "Managed by Terraform",
		});

		this.addTextRecord(
			"spf",
			"@",
			"v=spf1 include:spf.messagingengine.com ~all",
		);

		for (let i = 1; i <= 3; i++) {
			this.addCNameRecord(
				`dkim${i}`,
				`fm${i}._domainkey`,
				`fm${i}.${this.cloudflareZone.zone}.dkim.fmhosted.com`,
			);
		}

		this.addCNameRecord(
			`dkim-mesmtp`,
			`mesmtp._domainkey`,
			`mesmtp.${this.cloudflareZone.zone}.dkim.fmhosted.com`,
		);

		new Record(this, "srv-submission", {
			zoneId: this.cloudflareZone.id,
			name: "_submission_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 1,
				port: 587,
				target: "smtp.fastmail.com",
			},
			comment: "Managed by Terraform",
		});

		new Record(this, "srv-imap", {
			zoneId: this.cloudflareZone.id,
			name: "_imap_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 0,
				port: 0,
				target: ".",
			},
			comment: "Managed by Terraform",
		});

		new Record(this, "srv-imaps", {
			zoneId: this.cloudflareZone.id,
			name: "_imaps_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 1,
				port: 993,
				target: "imap.fastmail.com",
			},
			comment: "Managed by Terraform",
		});

		new Record(this, "srv-jmap", {
			zoneId: this.cloudflareZone.id,
			name: "_jmap_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 1,
				port: 443,
				target: "api.fastmail.com",
			},
			comment: "Managed by Terraform",
		});

		new Record(this, "srv-carddav", {
			zoneId: this.cloudflareZone.id,
			name: "_carddav_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 0,
				port: 0,
				target: ".",
			},
			comment: "Managed by Terraform",
		});

		new Record(this, "srv-carddavs", {
			zoneId: this.cloudflareZone.id,
			name: "_carddavs_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 1,
				port: 443,
				target: "carddav.fastmail.com",
			},
			comment: "Managed by Terraform",
		});

		new Record(this, "srv-caldav", {
			zoneId: this.cloudflareZone.id,
			name: "_caldav_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 0,
				port: 0,
				target: ".",
			},
			comment: "Managed by Terraform",
		});

		new Record(this, "srv-caldavs", {
			zoneId: this.cloudflareZone.id,
			name: "_caldavs_tcp",
			type: "SRV",
			ttl: 3600,
			data: {
				priority: 0,
				weight: 1,
				port: 443,
				target: "caldav.fastmail.com",
			},
			comment: "Managed by Terraform",
		});

		return this;
	}

	enableMicrosoft365(config: Microsoft365Config): ManagedDomain {
		new Record(this, "microsoft-mx", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 0,
			value: `${this.zoneString.replace(".", "-")}.mail.protection.outlook.com`,
			comment: "Managed by Terraform",
		});

		if (config.txtVerification) {
			this.addTextRecord(
				"microsoft-verification",
				"@",
				`MS=${config.txtVerification}`,
			);
		}

		this.addTextRecord(
			"microsoft-spf",
			"@",
			"v=spf1 include:spf.protection.outlook.com -all",
		)
			.addCNameRecord(
				"microsoft-discover",
				"autodiscover",
				"autodiscover.outlook.com",
			)
			.addCNameRecord(
				"microsoft-dkim-1",
				"selector1._domainkey",
				`selector1-${
					this.zoneString.replace(
						".",
						"-",
					)
				}._domainkey.rawkodeacademy.onmicrosoft.com`,
			)
			.addCNameRecord(
				"microsoft-dkim-2",
				"selector2._domainkey",
				`selector2-${
					this.zoneString.replace(
						".",
						"-",
					)
				}._domainkey.rawkodeacademy.onmicrosoft.com`,
			);

		return this;
	}

	enableSimpleLogin(): ManagedDomain {
		new Record(this, "mx1", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 1,
			value: "mx1.simplelogin.co.",
			comment: "Managed by Terraform",
		});

		new Record(this, "mx2", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 5,
			value: "mx2.simplelogin.co.",
			comment: "Managed by Terraform",
		});

		this.addTextRecord("spf", "@", "v=spf1 include:simplelogin.co ~all");

		this.addCNameRecord(
			"dkim1",
			"dkim._domainkey",
			"dkim._domainkey.simplelogin.co.",
		);

		this.addCNameRecord(
			"dkim2",
			"dkim02._domainkey",
			"dkim03._domainkey.simplelogin.co.",
		);

		this.addCNameRecord(
			"dkim3",
			"dkim03._domainkey",
			"dkim03._domainkey.simplelogin.co.",
		);

		this.addTextRecord(
			"dmarc",
			"_dmarc",
			"v=DMARC1; p=quarantine; pct=100; adkim=s; aspf=s",
		);

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
			comment: "Managed by Terraform",
		});

		new Record(this, "mx2", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 5,
			value: "alt1.aspmx.l.google.com.",
			comment: "Managed by Terraform",
		});

		new Record(this, "mx3", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 5,
			value: "alt2.aspmx.l.google.com.",
			comment: "Managed by Terraform",
		});

		new Record(this, "mx4", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 10,
			value: "alt3.aspmx.l.google.com.",
			comment: "Managed by Terraform",
		});

		new Record(this, "mx5", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 10,
			value: "alt4.aspmx.l.google.com.",
			comment: "Managed by Terraform",
		});

		this.addTextRecord(
			"dkim",
			"google._domainkey",
			`v=DKIM1; k=rsa; p=${config.domainKey}`,
		);

		this.addTextRecord(
			"spf",
			"@",
			`v=spf1 include:_spf.google.com ${
				config.spfIncludes
					? config.spfIncludes.map((include) => `include:${include}`)
						.join(" ")
					: ""
			} -all`,
		);

		return this;
	}

	enableProtonMail(config: ProtonMailConfig): ManagedDomain {
		this.addTextRecord(
			"verification",
			"@",
			`protonmail-verification=${config.verificationCode}`,
		);

		this.addTextRecord("spf", "@", "v=spf1 include:_spf.protonmail.ch ~all");

		this.addCNameRecord(
			"dkim1",
			"protonmail._domainkey",
			"protonmail.domainkey.d6tnun6yjhyqafzeqma5dsgy6epijgw5tlj4tmg2czg6apyp7cowa.domains.proton.ch.",
		);

		this.addCNameRecord(
			"dkim2",
			"protonmail2._domainkey",
			"protonmail2.domainkey.d6tnun6yjhyqafzeqma5dsgy6epijgw5tlj4tmg2czg6apyp7cowa.domains.proton.ch.",
		);

		this.addCNameRecord(
			"dkim3",
			"protonmail3._domainkey",
			"protonmail3.domainkey.d6tnun6yjhyqafzeqma5dsgy6epijgw5tlj4tmg2czg6apyp7cowa.domains.proton.ch.",
		);

		new Record(this, "mx1", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 10,
			value: "mail.protonmail.ch",
			comment: "Managed by Terraform",
		});

		new Record(this, "mx2", {
			zoneId: this.cloudflareZone.id,
			name: "@",
			type: "MX",
			ttl: 3600,
			priority: 20,
			value: "mailsec.protonmail.ch",
			comment: "Managed by Terraform",
		});
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

	enableResend(config: ResendConfig): ManagedDomain {
		new Record(this, "resend-mx", {
			zoneId: this.cloudflareZone.id,
			name: config.subdomain,
			type: "MX",
			ttl: 3600,
			priority: 10,
			value: config.mxValue,
			comment: "Managed by Terraform",
		});

		return this.addTextRecord(
			"resend-spf",
			config.subdomain,
			"v=spf1 include:amazonses.com ~all",
		).addTextRecord(
			"resend-domain-key",
			"resend._domainkey",
			`p=${config.domainKey}`,
		);
	}
}
