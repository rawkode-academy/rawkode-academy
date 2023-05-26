import { DataCloudinitConfig } from "@providers/cloudinit/data-cloudinit-config";
import { CloudinitProvider } from "@providers/cloudinit/provider";
import { MetalBgpSession } from "@providers/equinix/metal-bgp-session";
import { MetalDevice } from "@providers/equinix/metal-device";
import { MetalProject } from "@providers/equinix/metal-project";
import { MetalReservedIpBlock } from "@providers/equinix/metal-reserved-ip-block";
import { EquinixProvider } from "@providers/equinix/provider";
import {
  App,
  CloudBackend,
  NamedCloudWorkspace,
  TerraformOutput,
  TerraformStack,
} from "cdktf";
import { Construct } from "constructs";
import { readFileSync } from "fs";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new EquinixProvider(this, "equinix");
    new CloudinitProvider(this, "cloudinit", {});

    const project = new MetalProject(this, "project", {
      name: "rawkode-cloud",
      backendTransfer: false,
      bgpConfig: {
        asn: 65000,
        deploymentType: "local",
      },
    });

    const reservedIpBlock = new MetalReservedIpBlock(this, "gru-ipv4", {
      projectId: project.id,
      type: "global_ipv4",
      quantity: 1,
    });

    const cloudConfig = new DataCloudinitConfig(this, "gru-cloudconfig", {
      gzip: false,
      base64Encode: false,
      part: [
        {
          contentType: "text/x-shellscript",
          content: readFileSync("cloud-config/gru.sh", "utf8"),
        },
      ],
    });

    const gru = new MetalDevice(this, "gru-device", {
      description: "Gru",
      projectId: project.id,
      hostname: "gru",
      metro: "ld",
      plan: "c3.medium.x86",
      billingCycle: "hourly",
      operatingSystem: "ubuntu_22_04",
      userData: cloudConfig.rendered,
    });

    new MetalBgpSession(this, "gru-bgp", {
      deviceId: gru.id,
      addressFamily: "ipv4",
    });

    new TerraformOutput(this, "gru-ip", {
      value: gru.accessPublicIpv4,
      sensitive: false,
    });

    new TerraformOutput(this, "bgp-ip", {
      value: reservedIpBlock.address,
      sensitive: false,
    });
  }
}

const app = new App();
const stack = new MyStack(app, "rawkode.cloud");

new CloudBackend(stack, {
  hostname: "app.terraform.io",
  organization: "RawkodeAcademy",
  workspaces: new NamedCloudWorkspace("rawkode-cloud-infrastructure"),
});

app.synth();
