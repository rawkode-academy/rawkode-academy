import { App, HttpBackend } from "cdktf";
import { Cluster } from "./cluster";

const app = new App();

const cluster = new Cluster(app, "rawkode-cloud", {
  project: "rawkode-cloud",
});

const baseUrl = "https://terraform-state-backend.rawkode-academy.workers.dev";

new HttpBackend(cluster, {
  address: `${baseUrl}/states/rawkode-cloud-infrastructure`,
  lockMethod: "PUT",
  unlockMethod: "DELETE",
  lockAddress: `${baseUrl}/states/rawkode-cloud-infrastructure/lock`,
  unlockAddress: `${baseUrl}/states/rawkode-cloud-infrastructure/lock`,
  username: "rawkodeacademy",
});

app.synth();
