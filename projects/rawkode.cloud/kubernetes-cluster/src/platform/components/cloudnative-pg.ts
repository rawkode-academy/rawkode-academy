import { Component, ComponentArgs } from "./abstract";

export class CloudNativePG extends Component {
	protected readonly version = "1.18.1";
	protected crdUrls = [];

	static getComponentName(): string {
		return "cloudnative-pg";
	}

	constructor(name: string, args: ComponentArgs) {
		super(name, args);

		this.applyHelmRelease("cloudnative-pg", {
			repositoryOpts: {
				repo: "https://cloudnative-pg.github.io/charts",
			},
			chart: "cloudnative-pg",
			values: {
				image: {
					tag: this.version,
				},
			},
		});
	}
}
