import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const network = new gcp.compute.Network("network", {
  description: "Network for rawkode.cloud",
  autoCreateSubnetworks: true,
});

const firewall = new gcp.compute.Firewall("firewall", {
  name: "rawkode-cloud",
  network: network.name,
  allows: [
    {
      protocol: "tcp",
      ports: ["443"],
    },
  ],
  sourceTags: ["allow-https-ingress"],
});

const cloudDnsZone = gcp.dns.getManagedZone({
  name: "rawkode-cloud",
});
