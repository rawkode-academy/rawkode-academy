import { Output } from "@pulumi/pulumi";
import { GetConfigResult } from "@pulumi/cloudinit";
import * as gcp from "@pulumi/gcp";
import * as google from "@pulumi/google-native";

interface Config {
  name: string;
  zone: string;
  machineType: string;
  userData: Promise<GetConfigResult>;
  networkId: string | Output<string>;
  image: {
    family: string;
    project: string;
  };
  ipAddress?: string | Output<string>;
}
export const provisionMachine = async (config: Config) => {
  const image = await gcp.compute.getImage(config.image);

  const networkInterfaces = [
    {
      network: config.networkId,
      accessConfigs: [config.ipAddress ? { natIp: config.ipAddress } : {}],
    },
  ];

  const instance = new gcp.compute.Instance(
    config.name,
    {
      zone: config.zone,
      machineType: config.machineType,
      metadata: {
        "user-data": (await config.userData).rendered,
      },
      bootDisk: {
        initializeParams: {
          image: image.selfLink,
        },
      },
      networkInterfaces,
      serviceAccount: {
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      },
    },
    {
      deleteBeforeReplace: true,
      replaceOnChanges: ["*"],
    }
  );
};
