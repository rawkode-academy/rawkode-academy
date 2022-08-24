import { Construct } from "constructs";
import { App, Chart, ChartProps } from "cdk8s";
import * as kplus from "cdk8s-plus-24";

export class MyChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    new kplus.Deployment(this, "nginx", {
      containers: [{ image: "nginx" }],
    });
  }
}

const app = new App();
new MyChart(app, "platform");
app.synth();
