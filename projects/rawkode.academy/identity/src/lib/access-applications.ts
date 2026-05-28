export interface AccessRole {
	key: string;
	label: string;
	description: string;
}

export interface AccessApplication {
	clientId: string;
	name: string;
	description: string;
	roles: AccessRole[];
}

export const ACCESS_APPLICATIONS: AccessApplication[] = [
	{
		clientId: "comtrya",
		name: "Rawkode Academy Code",
		description: "code.rawkode.academy Comtrya instance",
		roles: [
			{
				key: "admin",
				label: "Admin",
				description: "Can access Comtrya admin surfaces.",
			},
			{
				key: "maintainer",
				label: "Maintainer",
				description: "Can maintain code.rawkode.academy content and repositories.",
			},
		],
	},
];

export function findAccessApplication(
	clientId: string,
): AccessApplication | undefined {
	return ACCESS_APPLICATIONS.find((app) => app.clientId === clientId);
}

export function findAccessRole(
	clientId: string,
	role: string,
): AccessRole | undefined {
	return findAccessApplication(clientId)?.roles.find((item) => item.key === role);
}
