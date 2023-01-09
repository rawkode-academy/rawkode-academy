import { Component, ComponentArgs } from "./abstract";

export class TemporalOperator extends Component {
	protected readonly version = "0.10.0";
	protected crdUrls = [
		`https://github.com/alexandrevilain/temporal-operator/releases/download/v${this.version}/temporal-operator.crds.yaml`,
	];

	static getComponentName(): string {
		return "temporal-operator";
	}

	constructor(name: string, args: ComponentArgs) {
		super(name, args);

		this.applyCrds();
		this.applyYamlNoTransformations(
			"temporal-operator",
			`https://github.com/alexandrevilain/temporal-operator/releases/download/v${this.version}/temporal-operator.yaml`,
		);
	}
}
