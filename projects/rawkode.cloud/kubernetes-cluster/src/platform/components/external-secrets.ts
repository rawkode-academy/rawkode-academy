import { Component, ComponentArgs } from "./abstract";

export class ExternalSecrets extends Component {
	protected readonly version = "v0.7.1";
	protected crdUrls = [
		`https://raw.githubusercontent.com/external-secrets/external-secrets/${this.version}/deploy/crds/bundle.yaml`,
	];

	static getComponentName(): string {
		return "external-secrets";
	}

	constructor(name: string, args: ComponentArgs) {
		super(name, args);

		this.applyCrds();
		this.applyHelmRelease("external-secrets", {
			chart: "external-secrets",
			version: this.version,
			repositoryOpts: {
				repo: "https://charts.external-secrets.io",
			},
			values: {},
		});
	}
}
