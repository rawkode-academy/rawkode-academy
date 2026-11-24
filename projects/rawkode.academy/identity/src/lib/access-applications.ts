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
		description: "Comtrya instance",
		roles: [
			{
				key: "admin",
				label: "Admin",
				description: "Can access Comtrya admin surfaces.",
			},
			{
				key: "maintainer",
				label: "Maintainer",
				description: "Can maintain Comtrya content and repositories.",
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
	{
		clientId: "rawkode-tools-mcp",
		name: "Rawkode Tools MCP",
		description: "mcp.rawkode.tools, the MCP server for Claude, ChatGPT and other MCP clients",
		roles: [
			{
				key: "operator",
				label: "Operator",
				description:
					"May connect MCP clients and use every Rawkode Tools module, such as analytics.",
			},
			{
				key: "guest",
				label: "Guest",
				description:
					"May connect MCP clients and see only the YouTube numbers of episodes they guest on, or of every episode of a show they host. Needs a GitHub-linked account.",
			},
		],
	},
];

export const ROLE_KEYS = Object.freeze({
	studioOperator: "studio_operator",
	toolsOperator: "operator",
	toolsGuest: "guest",
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
