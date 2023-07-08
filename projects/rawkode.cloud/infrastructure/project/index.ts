import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { ScalewayProvider } from "../.gen/providers/scaleway/provider";
import { AccountProject } from "../.gen/providers/scaleway/account-project";
import { getBackend } from "../backend";

interface Config {
  name: string;
  description: string;
}
export class Project extends TerraformStack {
  public readonly project: AccountProject;

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);

    getBackend(this, `${id}-project`);

    new ScalewayProvider(this, "scaleway");

    this.project = new AccountProject(this, "project", {
      name: config.name,
      description: config.description,
    });
  }
}
