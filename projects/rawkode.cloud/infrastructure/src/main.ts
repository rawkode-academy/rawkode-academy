import { MetalDevice } from "@providers/equinix/metal-device";
import { MetalProject } from "@providers/equinix/metal-project";
import { App, CloudBackend, NamedCloudWorkspace, TerraformStack } from "cdktf";
import { Construct } from "constructs";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const project = new MetalProject(this, "project", {
      name: "rawkode-cloud",
      backendTransfer: false,
      bgpConfig: {
        asn: 65000,
        deploymentType: "global",
      },
    });

    new MetalDevice(this, "gru", {
      description: "Gru",
      projectId: project.id,
      hostname: "gru",
      metro: "ld",
      plan: "c3.small.x86",
      billingCycle: "hourly",
      operatingSystem: "ubuntu_22_04",
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
