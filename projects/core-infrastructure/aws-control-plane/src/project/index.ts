import * as aws from "@pulumi/aws";
import { ComponentResource, ComponentResourceOptions } from "@pulumi/pulumi";

interface RawkodeProjectOptionalArgs {
	// Never Optional
	provider: aws.Provider;

	policyAttachments?: aws.iam.ManagedPolicy[];
	policyStatements?: aws.iam.PolicyStatement[];
	createAccessKey?: boolean;
}

interface RawkodeProjectArgs {
	policyAttachments: aws.iam.ManagedPolicy[];
	policyStatements: aws.iam.PolicyStatement[];
	createAccessKey: boolean;
	provider: aws.Provider;
}

export const configureProject = (
	args: RawkodeProjectOptionalArgs,
): RawkodeProjectArgs => ({
	createAccessKey: false,
	policyAttachments: [],
	policyStatements: [],
	...args,
});

export class RawkodeProject extends ComponentResource {
	public readonly iamUser: aws.iam.User;
	public readonly iamUserPolicy?: aws.iam.UserPolicy;
	public readonly iamUserPolicyAttachments: aws.iam.UserPolicyAttachment[] = [];

	constructor(
		name: string,
		args: RawkodeProjectArgs,
		opts?: ComponentResourceOptions,
	) {
		super("rawkode:project", name, args, opts);

		this.iamUser = new aws.iam.User(
			name,
			{
				name,
				path: "/core-infrastructure/",
				tags: {
					managedBy: "pulumi/aws-control-plane",
				},
			},
			{
				parent: this,
				deleteBeforeReplace: true,
				provider: args.provider,
			},
		);

		this.iamUserPolicyAttachments =
			args.policyAttachments.map<aws.iam.UserPolicyAttachment>(
				(policy) =>
					new aws.iam.UserPolicyAttachment(
						`${name}-${policy.toLowerCase().split("/").pop()}`,
						{
							user: this.iamUser.name,
							policyArn: policy,
						},
						{
							parent: this,
							deleteBeforeReplace: true,
							provider: args.provider,
						},
					),
			);

		if (args.policyStatements.length > 0) {
			this.iamUserPolicy = new aws.iam.UserPolicy(
				name,
				{
					user: this.iamUser.name,
					policy: {
						Version: "2012-10-17",
						Statement: args.policyStatements,
					},
				},
				{
					parent: this,
					deleteBeforeReplace: true,
					provider: args.provider,
				},
			);
		}
	}
}
