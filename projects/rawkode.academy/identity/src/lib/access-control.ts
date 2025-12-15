import {
	createAccessControl,
	defaultStatements,
} from "better-auth/plugins/access";

const statement = {
	...defaultStatements,
	content: ["create", "update", "delete", "publish"],
} as const;

export const ac = createAccessControl(statement);

// Owner: Full control
export const owner = ac.newRole({
	organization: ["update", "delete"],
	member: ["create", "update", "delete"],
	invitation: ["create", "cancel"],
	content: ["create", "update", "delete", "publish"],
});

// Admin: Full control except delete org
export const admin = ac.newRole({
	organization: ["update"],
	member: ["create", "update", "delete"],
	invitation: ["create", "cancel"],
	content: ["create", "update", "delete", "publish"],
});

// Moderator: Manage members and content, no org settings
export const moderator = ac.newRole({
	member: ["create", "update"],
	invitation: ["create", "cancel"],
	content: ["create", "update", "delete", "publish"],
});

// Contributor: Create/update content only
export const contributor = ac.newRole({
	content: ["create", "update"],
});

// Member: Read-only (no explicit permissions needed)
export const member = ac.newRole({});
