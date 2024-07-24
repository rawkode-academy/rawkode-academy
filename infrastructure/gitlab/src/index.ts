import { App, HttpBackend, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { GitlabProvider } from "@generatedProviders/gitlab/provider";
import { Project } from "@generatedProviders/gitlab/project";
import { GroupLabel } from "@generatedProviders/gitlab/group-label";
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

		new GroupLabel(this, "label-status-backlog", {
			name: "status::Backlog",
			color: "#ed9121",
			description: "These issues are ready to be picked up and worked on.",
			group: group.id,
		});

		new GroupLabel(this, "label-status-triage", {
			name: "status::Needs Triage",
			color: "#ed9121",
			description:
				"These issues need to be triaged by the team and are not ready to work on.",
			group: group.id,
		});

		new GroupLabel(this, "label-status-picked-up", {
			name: "status::Picked Up",
			color: "#ed9121",
			description:
				"These issues have been assigned and will be worked on shortly.",
			group: group.id,
		});

		new GroupLabel(this, "label-status-in-review", {
			name: "status::In Review",
			color: "#ed9121",
			description: "These issues are currently being reviewed by the team.",
			group: group.id,
		});

		new GroupLabel(this, "label-type-operations", {
			name: "type::Operations",
			group: group.id,
			color: "#6699cc",
			description: "These issues are operational tasks.",
		});

		new GroupLabel(this, "label-type-defect", {
			name: "type::Defect",
			group: group.id,
			color: "#6699cc",
			description: "These issues are defects in the system.",
		});

		new GroupLabel(this, "label-type-enhancement", {
			name: "type::Enhancement",
			group: group.id,
			color: "#6699cc",
			description: "These issues are enhancements to the system.",
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
