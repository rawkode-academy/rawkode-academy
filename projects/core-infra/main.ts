import { App } from "cdktf";
import { Project } from "./project";
import { Cluster } from "./cluster";

const app = new App();

const project = new Project(app, "project");

new Cluster(app, "cluster", {
	project: project.project.projectId,
});

app.synth();
