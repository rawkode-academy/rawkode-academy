import * as kplus from "cdk8s-plus-22";
import * as cdk8s from "cdk8s";

const app = new cdk8s.App();
const chart = new cdk8s.Chart(app, "Chart");

new kplus.Deployment(chart, "Deployment", {
  replicas: 3,
  containers: [
    {
      image: "nginx",
    },
  ],
});

app.synth();
