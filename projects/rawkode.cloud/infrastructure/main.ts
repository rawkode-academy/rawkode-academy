import { App } from "cdktf";
import { Project } from "./project";

const app = new App();

new Project(app, "rawkode-cloud", {
  name: "rawkode.cloud",
  description: "Rawkode Cloud",
});

app.synth();

