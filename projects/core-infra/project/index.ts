import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { GoogleProvider } from "../.gen/providers/google/provider";
import { Project as GoogleProject } from "../.gen/providers/google/project";
import { ProjectService } from "../.gen/providers/google/project-service";

export const location = "europe-west4-a";

const enableServices = [
	"compute.googleapis.com",
	"iam.googleapis.com",
	"container.googleapis.com",
];

export class Project extends TerraformStack {
	public readonly project: GoogleProject;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		new GoogleProvider(this, "google");

		this.project = new GoogleProject(this, "project", {
			name: "rawkode-cloud",
			projectId: "rawkode-cloud",
			orgId: "793576735832",
			billingAccount: "01B975-72272E-DCA213",
		});

		enableServices.map(
			(service) =>
				new ProjectService(this, service, {
					service,
					project: this.project.projectId,

					timeouts: {
						create: "30m",
						update: "40m",
					},

					disableDependentServices: true,
				}),
		);

		new ProjectService(this, "compute", {
			project: this.project.projectId,
			service: "compute.googleapis.com",

			timeouts: {
				create: "30m",
				update: "40m",
			},

			disableDependentServices: true,
		});
	}
}
