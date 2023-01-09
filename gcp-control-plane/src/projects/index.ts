import { GoogleProjectIamBinding } from "@cdktf/provider-google-beta/lib/google-project-iam-binding";
import { GoogleServiceAccount } from "@cdktf/provider-google-beta/lib/google-service-account";
import { TerraformStack } from "cdktf";

interface ProjectInput {
	isPulumiProject: boolean;
	includedPermissions: string[];
}

interface ProjectOutput {
	serviceAccount: GoogleServiceAccount;
	role: GoogleProjectIamBinding;
}

const createProject = (
	scope: TerraformStack,
	name: string,
	args: ProjectInput,
): ProjectOutput => {
	const serviceAccount = new GoogleServiceAccount(
		scope,
		`${name}-service-account`,
		{
			accountId: name,
			displayName: name,
		},
	);

	const role = new GoogleProjectIamBinding(
		scope,
		`${name}-project-iam-binding`,
		{
			project: "",
			role: "",
			members: [`serviceAccount:${serviceAccount.email}`],
		},
	);

	return {
		serviceAccount,
		role,
	};
};
