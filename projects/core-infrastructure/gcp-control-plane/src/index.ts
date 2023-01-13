import * as pulumi from "@pulumi/pulumi";
import { GcpControlPlane } from "./control-plane";

const config = new pulumi.Config("gcp");

const controlPlane = new GcpControlPlane("control-plane", {
	gcpProject: config.require("project"),
	gcpRegion: config.require("region"),
});

controlPlane.enablePulumiIntegration();

const coreInfrastructureDns = controlPlane
	.createProject("core-infrastructure-dns")
	.createAccessKey()
	.enablePulumiSupport();
