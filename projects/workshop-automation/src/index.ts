import { Config } from "@pulumi/pulumi";
import { getConfig, GetConfigResult } from "@pulumi/cloudinit";
import { GetConfigPart } from "@pulumi/cloudinit/types/input";
import * as google from "@pulumi/google-native";

const config = new Config();
const workshopName = `workshop-${config.require("name")}`;

const domain = `${workshopName}.rawkode.academy`;
const region = "europe-west2";

// Common Config
const image = {
  family: "ubuntu-2004-lts",
  project: "ubuntu-os-cloud",
};

// Create the Teleport Cluster
const network = new google.compute.v1.Network("network", {
  autoCreateSubnetworks: true,
});

const firewall = new google.compute.v1.Firewall("firewall", {
  network: network.selfLink,
  allowed: [
    {
      ipProtocol: "tcp",
      ports: ["443", "22", "3021", "3022", "3025", "3028", "16000", "33000"],
    },
  ],
});

const renderUserData = (parts: GetConfigPart[]): Promise<GetConfigResult> =>
  getConfig({
    base64Encode: false,
    gzip: false,
    parts,
  });

// Attendee Teams and Machines
import * as github from "@pulumi/github";
import { provisionMachine } from "./common/provisionMachine";
import { userData as workloadUserData } from "./kubernetes";
import { attendees } from "./attendees";

attendees.forEach((attendee) => {
  const handle = attendee.toLowerCase();

  const githubTeam = new github.Team(handle, {
    name: `${workshopName}-${handle}`,
  });

  const githubTeamMember = new github.TeamMembership(handle, {
    teamId: githubTeam.id,
    username: handle,
    role: "member",
  });

  const ipAddress = new google.compute.v1.Address(handle, {
    region,
  });

  provisionMachine({
    name: handle,
    networkId: network.selfLink,
    ipAddress: ipAddress.address,
    zone: "europe-west2-c",
    machineType: "e2-standard-4",
    userData: renderUserData(
      workloadUserData({ workshopName, attendee: handle })
    ),
    image,
  });
});

const teleportIpAddress = new google.compute.v1.Address("teleport-ip", {
  region,
});

import { ClusterUserData } from "./teleport";

provisionMachine({
  name: "teleport",
  networkId: network.selfLink,
  ipAddress: teleportIpAddress.address,
  zone: "europe-west2-c",
  machineType: "e2-standard-4",
  userData: renderUserData(
    ClusterUserData({
      workshopName,
      githubClientId: process.env.GITHUB_CLIENT_ID!,
      githubClientSecret: process.env.GITHUB_CLIENT_SECRET!,
      attendees,
    })
  ),
  image,
});

const teleportDns = new google.dns.v1.ResourceRecordSet(
  "teleport-dns",
  {
    managedZone: "rawkode-academy-40f0c90",
    ttl: 360,
    type: "A",
    rrdatas: [teleportIpAddress.address],
    name: `${domain}.`,
  },
  {
    deleteBeforeReplace: true,
  }
);
