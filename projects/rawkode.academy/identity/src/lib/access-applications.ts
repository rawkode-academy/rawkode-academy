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
	{
		clientId: "rawkode-academy-payload",
		name: "Rawkode Academy CMS",
		description: "admin.rawkode.academy and preview.rawkode.academy (Payload)",
		roles: [
			{
				key: "staff",
				label: "Staff",
				description:
					"Editorial admin, review intake, grants and publish in production Payload.",
			},
		],
	},
	{
		clientId: "rawkode-academy-preview",
		name: "Rawkode Academy CMS (PR previews)",
		description: "Payload PR preview Workers backed by -preview data",
		roles: [
			{
				key: "staff",
				label: "Staff",
				description:
					"Staff on PR preview Workers backed by -preview data only.",
			},
		],
	},
	{
		clientId: "rawkode-studio",
		name: "Rawkode Studio",
		description: "rawkode.studio live production",
		roles: [
			{
				key: "studio_operator",
				label: "Studio operator",
				description:
					"May create and manage any Studio session and hand off recordings.",
			},
		],
	},
];

export const ROLE_KEYS = Object.freeze({
	staff: "staff",
	studioOperator: "studio_operator",
} as const);

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
