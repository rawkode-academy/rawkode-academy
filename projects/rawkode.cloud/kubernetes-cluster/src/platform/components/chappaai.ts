import { Component, ComponentArgs } from "./abstract";

export class Chappaai extends Component {
	protected readonly version = "0.0.5";
	protected crdUrls = [
		`https://github.com/rawkode/chappaai/releases/download/${this.version}/crds.yaml`,
	];

	static getComponentName(): string {
		return "chappaai";
	}

	constructor(name: string, args: ComponentArgs) {
		super(name, args);

		this.applyCrds();
	}
}
