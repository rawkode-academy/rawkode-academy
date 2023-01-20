import { Construct } from "constructs";
import { KubernetesProvider } from "@cdktf/provider-kubernetes/lib/provider";
import { HelmProvider } from "@cdktf/provider-helm/lib/provider";
import { Namespace } from "@cdktf/provider-kubernetes/lib/namespace";

export interface PlatformComponentArgs {
	namespace: Namespace;
	helmProvider: HelmProvider;
	kubernetesProvider: KubernetesProvider;
}

export abstract class PlatformComponent extends Construct {
	protected helmProvider: HelmProvider;
	protected kubernetesProvider: KubernetesProvider;
	protected namespace: Namespace;

	constructor(scope: Construct, id: string, args: PlatformComponentArgs) {
		super(scope, id);

		this.namespace = args.namespace;
		this.helmProvider = args.helmProvider;
		this.kubernetesProvider = args.kubernetesProvider;
	}
}
