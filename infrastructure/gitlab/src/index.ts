import { App, HttpBackend, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { GitlabProvider } from "@generatedProviders/gitlab/provider";
import { Project } from "@generatedProviders/gitlab/project";
import { DataGitlabGroup } from "@generatedProviders/gitlab/data-gitlab-group";

class GitLab extends TerraformStack {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		new GitlabProvider(this, "gitlab", {
			token: process.env.GITLAB_ACCESS_TOKEN,
		});

		const group = new DataGitlabGroup(this, "group", {
			fullPath: "RawkodeAcademy",
		});

		new Project(this, "monorepository", {
			name: "RawkodeAcademy",
			namespaceId: group.groupId,
			description: "Rawkode Academy Monorepository",
			visibilityLevel: "public",
		});
	}
}

const stackId = "gitlab";

const app = new App();
const stack = new GitLab(app, stackId);
const terraformBaseUrl = process.env.TERRAFORM_STATE_URL;

if (!terraformBaseUrl) {
	throw new Error("TERRAFORM_STATE_URL is required");
}

new HttpBackend(stack, {
	address: `${terraformBaseUrl}/${stackId}`,
	retryWaitMin: 5,

	// lockAddress: `${terraformBaseUrl}/${stackId}/lock`,
	// lockMethod: "PUT",

	// unlockAddress: `${terraformBaseUrl}/${stackId}/lock`,
	// unlockMethod: "DELETE",

	username: "rawkode",
	password: process.env.GITLAB_ACCESS_TOKEN,
});

app.synth();
