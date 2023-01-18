import { Construct } from "constructs";
import { PlatformComponent, PlatformComponentArgs } from "./abstract";
import { Release } from "@cdktf/provider-helm/lib/release";

export class FluxCD extends PlatformComponent {
	constructor(scope: Construct, id: string, args: PlatformComponentArgs) {
		super(scope, id, args);

		new Release(this, "fluxcd", {
			provider: args.helmProvider,
			namespace: args.namespace.metadata.name,
			createNamespace: false,
			name: "fluxcd",
			chart: "flux2",
			repository: "https://fluxcd-community.github.io/helm-charts",
			set: [
				{
					name: "watchAllNamespaces",
					value: "true",
				},
				{
					name: "policies.create",
					value: "false",
				},

				{
					name: "helmController.create",
					value: "true",
				},
				{
					name: "kustomizeController.create",
					value: "true",
				},
			],
		});
	}
}
