import * as cloudflare from "@pulumi/cloudflare";

interface DnsRecord {
  name: string;
  type: "A" | "CNAME" | "TXT" | "MX";
  value: string;
  proxied: boolean;
}

interface MxRecord extends DnsRecord {
  type: "MX";
  proxied: false;
  priority: number;
}

interface Domain {
  name: string;
  domain: string;
  records: {
    [name: string]: DnsRecord | MxRecord;
  };
}

const rawkodeAcademy: Domain = {
  name: "rawkode-academy",
  domain: "rawkode.academy",
  records: {
    mx1: {
      name: "@",
      type: "MX",
      priority: 1,
      value: "aspmx.l.google.com",
      proxied: false,
    },
    mx2: {
      name: "@",
      type: "MX",
      priority: 5,
      value: "alt1.aspmx.l.google.com",
      proxied: false,
    },
    mx3: {
      name: "@",
      type: "MX",
      priority: 5,
      value: "alt2.aspmx.l.google.com",
      proxied: false,
    },
    mx4: {
      name: "@",
      type: "MX",
      priority: 10,
      value: "alt3.aspmx.l.google.com",
      proxied: false,
    },
    mx5: {
      name: "@",
      type: "MX",
      priority: 10,
      value: "alt4.aspmx.l.google.com",
      proxied: false,
    },
    txt1: {
      name: "@",
      type: "TXT",
      value: '"v=spf1 include:_spf.google.com ~all"',
      proxied: false,
    },
  },
};

const rawkodeCommunity: Domain = {
  name: "rawkode-community",
  domain: "rawkode.community",
  records: {
    txt1: {
      name: "@",
      type: "TXT",
      value: '"v=spf1 ~all"',
      proxied: false,
    },
  },
};

const reconcileDomain = (domain: Domain) => {
  const zone = new cloudflare.Zone(domain.name, {
    zone: domain.domain,
    jumpStart: false,
    paused: false,
    plan: "free",
    type: "full",
  });

  const zoneSettings = new cloudflare.ZoneSettingsOverride(
    domain.name,
    {
      zoneId: zone.id,
      settings: {
        alwaysUseHttps: "on",
        automaticHttpsRewrites: "on",
        ssl: "strict",
        minTlsVersion: "1.2",
        universalSsl: "on",
      },
    },
    {
      parent: zone,
    }
  );

  const recordKeys = Object.keys(domain.records);
  recordKeys.forEach((key) => {
    const record = domain.records[key];

    new cloudflare.Record(
      `${domain.name}-${key}`,
      {
        zoneId: zone.id,
        ...record,
      },
      {
        parent: zone,
      }
    );
  });
};

reconcileDomain(rawkodeAcademy);
reconcileDomain(rawkodeCommunity);
