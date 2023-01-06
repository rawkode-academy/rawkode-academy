import { RandomPassword } from "@pulumi/random";
import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as slug from "slug";
import { Output } from "@pulumi/pulumi";
// import { IngressComponent } from "../components/abstract";
// import { getController } from "../../dns";

export interface ProjectArgs {
	repository: string;
	directory: string;
	platformDependency: pulumi.Resource[];
	provider: kubernetes.Provider;
	// ingressComponent?: IngressComponent;
	environment: { [key: string]: string };
	secrets: { [key: string]: Output<string> };
}

export class Project extends pulumi.ComponentResource {
	private namespace: kubernetes.core.v1.Namespace;
	private configMap: kubernetes.core.v1.ConfigMap;
	private operatorServiceAccount: kubernetes.core.v1.ServiceAccount;
	private operatorRole: kubernetes.rbac.v1.Role;
	private operatorRoleBinding: kubernetes.rbac.v1.RoleBinding;
	private stackSecret: RandomPassword;
	private persistentVolumeClaim: kubernetes.core.v1.PersistentVolumeClaim;
	private operator: kubernetes.apps.v1.Deployment;
	private pulumiKubernetesSecret: kubernetes.core.v1.Secret;
	private stack: kubernetes.apiextensions.CustomResource;

	constructor(
		name: string,
		args: ProjectArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("rawkode:platform:Project", name, args, opts);

		const slugName = slug(name);
		const provider = args.provider;

		this.namespace = new kubernetes.core.v1.Namespace(
			slugName,
			{
				// Disable auto-naming on this namespace for consistent experience for developers
				metadata: {
					name,
				},
			},
			{ provider, parent: this },
		);
		const namespace = this.namespace.metadata.name;

		new kubernetes.core.v1.Secret(`${slugName}-secrets`, {
			metadata: {
				namespace,
				name: "platform",
			},
			stringData: args.secrets,
		});

		this.configMap = new kubernetes.core.v1.ConfigMap(
			`${slugName}-environment`,
			{
				metadata: {
					namespace,
					name: "environment",
				},
				data: args.environment,
			},
			{
				provider,
				parent: this,
			},
		);

		this.operatorServiceAccount = new kubernetes.core.v1.ServiceAccount(
			`${slugName}-pulumi-operator-service-account`,
			{
				metadata: {
					namespace,
				},
			},
			{
				provider,
				parent: this,
			},
		);

		this.operatorRole = new kubernetes.rbac.v1.Role(
			`${slugName}-pulumi-operator-role`,
			{
				metadata: {
					namespace,
				},
				rules: [
					{
						apiGroups: ["*"],
						resources: ["*"],
						verbs: ["*"],
					},
				],
			},
			{
				provider,
				parent: this,
			},
		);

		this.operatorRoleBinding = new kubernetes.rbac.v1.RoleBinding(
			`${slugName}-pulumi-operator-role-binding`,
			{
				metadata: {
					namespace,
				},
				subjects: [
					{
						kind: "ServiceAccount",
						name: this.operatorServiceAccount.metadata.name,
					},
				],
				roleRef: {
					kind: "Role",
					name: this.operatorRole.metadata.name,
					apiGroup: "rbac.authorization.k8s.io",
				},
			},
			{
				provider,
				parent: this,
			},
		);

		const fluxRole = new kubernetes.rbac.v1.Role(
			`${slugName}-pulumi-operator-flux-role`,
			{
				rules: [
					{
						apiGroups: ["source.toolkit.fluxcd.io"],
						resources: ["*"],
						verbs: ["get", "list", "watch"],
					},
				],
			},
			{
				provider,
				parent: this,
			},
		);

		const fluxRoleBinding = new kubernetes.rbac.v1.RoleBinding(
			`${slugName}-pulumi-operator-flux-role-binding`,
			{
				subjects: [
					{
						kind: "ServiceAccount",
						name: this.operatorServiceAccount.metadata.name,
					},
				],
				roleRef: {
					apiGroup: "rbac.authorization.k8s.io",
					kind: "Role",
					name: fluxRole.metadata.name,
				},
			},
			{
				provider,
				parent: this,
			},
		);

		const operatorName = `${slugName}-operator`;

		this.stackSecret = new RandomPassword(`${slugName}-pulumi-stack-secret`, {
			length: 32,
		});

		this.pulumiKubernetesSecret = new kubernetes.core.v1.Secret(
			`${slugName}-password`,
			{
				metadata: {
					namespace,
				},
				stringData: {
					password: this.stackSecret.result,
				},
			},
			{
				provider,
				parent: this,
			},
		);

		this.persistentVolumeClaim = new kubernetes.core.v1.PersistentVolumeClaim(
			`${slugName}-operator`,
			{
				metadata: {
					namespace,
					annotations: {
						"pulumi.com/skipAwait": "true",
					},
				},
				spec: {
					accessModes: ["ReadWriteOnce"],
					resources: {
						requests: {
							storage: "10Gi",
						},
					},
				},
			},
			{
				provider,
				parent: this,
			},
		);

		this.operator = new kubernetes.apps.v1.Deployment(
			`${slugName}-pulumi-kubernetes-operator`,
			{
				metadata: {
					namespace,
				},
				spec: {
					replicas: 1,
					strategy: {
						type: "Recreate",
					},
					selector: {
						matchLabels: {
							name: operatorName,
						},
					},

					template: {
						metadata: {
							labels: {
								name: operatorName,
							},
						},
						spec: {
							serviceAccountName: this.operatorServiceAccount.metadata.name,
							volumes: [
								{
									name: "state",
									persistentVolumeClaim: {
										claimName: this.persistentVolumeClaim.metadata.name,
									},
								},
							],
							securityContext: {
								fsGroup: 1000,
							},
							containers: [
								{
									name: "operator",
									image: "pulumi/pulumi-kubernetes-operator:v1.10.1",
									args: ["--zap-level=error", "--zap-time-encoding=iso8601"],
									imagePullPolicy: "Always",
									volumeMounts: [
										{
											name: "state",
											mountPath: "/state",
										},
									],
									env: [
										{
											name: "WATCH_NAMESPACE",
											valueFrom: {
												fieldRef: {
													fieldPath: "metadata.namespace",
												},
											},
										},
										{
											name: "POD_NAME",
											valueFrom: {
												fieldRef: {
													fieldPath: "metadata.name",
												},
											},
										},
										{
											name: "OPERATOR_NAME",
											value: `${slugName}-operator`,
										},
										{
											name: "GRACEFUL_SHUTDOWN_TIMEOUT_DURATION",
											value: "5m",
										},
										{
											name: "MAX_CONCURRENT_RECONCILES",
											value: "1",
										},
										{
											name: "PULUMI_INFER_NAMESPACE",
											value: "1",
										},
									],
								},
							],
							// Should be same or larger than GRACEFUL_SHUTDOWN_TIMEOUT_DURATION
							terminationGracePeriodSeconds: 300,
						},
					},
				},
			},
			{
				provider,
				parent: this,
				dependsOn: [...args.platformDependency, this.operatorRoleBinding],
			},
		);

		const ociRepository = new kubernetes.apiextensions.CustomResource(
			`${slugName}-repo`,
			{
				apiVersion: "source.toolkit.fluxcd.io/v1beta2",
				kind: "OCIRepository",
				metadata: {
					namespace,
				},
				spec: {
					interval: "5m0s",
					url: args.repository,
					ref: { tag: "latest" },
				},
			},
			{
				provider,
				parent: this,
			},
		);

		this.stack = new kubernetes.apiextensions.CustomResource(
			`${slugName}-stack`,
			{
				apiVersion: "pulumi.com/v1",
				kind: "Stack",
				metadata: {
					namespace,
				},
				spec: {
					stack: slugName,
					fluxSource: {
						sourceRef: {
							apiVersion: ociRepository.apiVersion,
							kind: ociRepository.kind,
							name: ociRepository.metadata.name,
						},
						dir: args.directory,
					},
					destroyOnFinalize: true,
					continueResyncOnCommitMatch: true,
					resyncFrequencySeconds: 60,
					backend: "file:///state",
					refresh: true,
					envRefs: {
						PULUMI_CONFIG_PASSPHRASE: {
							type: "Secret",
							secret: {
								namespace,
								name: this.pulumiKubernetesSecret.metadata.name,
								key: "password",
							},
						},
					},
				},
			},
			{
				provider,
				parent: this,
				dependsOn: [this.operator, this.configMap],
			},
		);

		// for (const key in args.environment) {
		//   if (!key.endsWith("Domain")) {
		//     continue;
		//   }

		//   const value = args.environment[key];

		//   // This is rather crude
		//   const domain = value.split(".").slice(-2).join(".");
		//   const subdomain = value.split(".").slice(0, -2).join(".");
		//   const dnsController = getController(domain);

		//   args.ingressComponent?.getIpAddress().apply((ip) => {
		//     dnsController.createRecord(subdomain, "A", [ip]);
		//   });
		// }

		this.registerOutputs({
			namespaceName: this.namespace.metadata.name,
			stackName: this.stack.metadata.name,
		});
	}

	public get stackName(): pulumi.Output<string> {
		return this.stack.metadata.name;
	}
}
