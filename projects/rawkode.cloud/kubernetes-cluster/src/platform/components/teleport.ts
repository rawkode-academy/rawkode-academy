import { Component, ComponentArgs } from "./abstract";
import * as google from "@pulumi/gcp";

export class Teleport extends Component {
	protected readonly version = "1.7.1";
	protected crdUrls = [];

	static getComponentName(): string {
		return "teleport";
	}

	constructor(name: string, args: ComponentArgs) {
		super(name, args);

		const joinToken = google.secretmanager.getSecretVersion({
			secret: "rawkode-cloud-shared",
		});

		this.applyHelmRelease("teleport", {
			chart: "teleport-kube-agent",
			repositoryOpts: {
				repo: "https://charts.releases.teleport.dev",
			},
			values: {
				roles: "kube,app,db",
				proxyAddr: "rawkode.cloud:443",
				authToken: joinToken.then((secret) => {
					const data = JSON.parse(secret.secretData);
					return data["TELEPORT_JOIN_TOKEN"];
				}),
				appResources: [
					{
						labels: {
							"rawkode.cloud/expose": "true",
						},
					},
				],
				databaseResources: [
					{
						labels: {
							"rawkode.cloud/expose": "true",
						},
					},
				],
				kubeClusterName: "rawkode.cloud",
			},
		});
	}
}
