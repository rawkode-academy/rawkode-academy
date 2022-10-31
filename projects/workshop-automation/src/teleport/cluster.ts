import { GetConfigPart } from "@pulumi/cloudinit/types/input";
import * as fs from "fs";
import * as path from "path";
import * as handlebars from "handlebars";

handlebars.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

const cloudConfigPath = "../../cloud-config";

const loadCloudConfig = (name: string) =>
  fs.readFileSync(
    path.resolve(__dirname, `${cloudConfigPath}/common/bootstrap.sh`),
    "utf-8"
  );

const interpolate = (config: Config, template: string): string => {
  const compiled = handlebars.compile(template);

  return compiled(config);
};

interface Config {
  workshopName: string;
  githubClientId: string;
  githubClientSecret: string;
  attendees: string[];
}

export const userData = (config: Config): GetConfigPart[] => {
  return [
    {
      contentType: "text/x-shellscript",
      content: fs.readFileSync(
        path.resolve(__dirname, `${cloudConfigPath}/common/bootstrap.sh`),
        "utf-8"
      ),
    },
    {
      contentType: "text/x-shellscript",
      content: fs.readFileSync(
        path.resolve(__dirname, `${cloudConfigPath}/teleport/install.sh`),
        "utf-8"
      ),
    },
    {
      contentType: "text/x-shellscript",
      content: interpolate(
        config,
        fs.readFileSync(
          path.resolve(__dirname, `${cloudConfigPath}/teleport/server.sh`),
          "utf-8"
        )
      ),
    },
    {
      contentType: "text/x-shellscript",
      content: interpolate(
        config,
        fs.readFileSync(
          path.resolve(__dirname, `${cloudConfigPath}/teleport/github-sso.sh`),
          "utf-8"
        )
      ),
    },
  ];
};
