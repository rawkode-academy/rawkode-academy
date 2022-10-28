import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const network = new gcp.compute.Network("rawkode-cloud", {
  description: "Network for rawkode.cloud",
  autoCreateSubnetworks: true,
});

export const networkId = network.id;
