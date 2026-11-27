import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { GithubProfile, OrgRole } from "./github-profile";

type Db = DrizzleD1Database<typeof schema>;

export type AddMemberResult =
	| { status: "added"; userId: string }
	| { status: "already_member"; userId: string }
	| { status: "pending" }
	| { status: "already_pending" };

/**
 * Adds a GitHub account to an organisation. An existing account becomes a
 * member immediately; one that has never signed in gets a pending membership,
 * claimed on first sign-in.
 */
export const addMemberByGithub = async (
	db: Db,
	input: {
		organizationId: string;
		profile: GithubProfile;
		role: OrgRole;
		invitedByUserId: string;
	},
): Promise<AddMemberResult> => {
	const { organizationId, profile, role, invitedByUserId } = input;

	const account = await db.query.account.findFirst({
		where: and(
			eq(schema.account.providerId, "github"),
			eq(schema.account.accountId, profile.id),
		),
	});

	if (account) {
		const existing = await db.query.member.findFirst({
			where: and(
				eq(schema.member.organizationId, organizationId),
				eq(schema.member.userId, account.userId),
			),
		});
		if (existing) return { status: "already_member", userId: account.userId };
		await db.insert(schema.member).values({
			id: crypto.randomUUID(),
			organizationId,
			userId: account.userId,
			role,
			createdAt: new Date(),
		});
		return { status: "added", userId: account.userId };
	}

	const pending = await db.query.pendingMember.findFirst({
		where: and(
			eq(schema.pendingMember.organizationId, organizationId),
			eq(schema.pendingMember.githubId, profile.id),
		),
	});
	if (pending) return { status: "already_pending" };
	await db.insert(schema.pendingMember).values({
		id: crypto.randomUUID(),
		organizationId,
		githubId: profile.id,
		githubLogin: profile.login,
		role,
		invitedByUserId,
	});
	return { status: "pending" };
};

/**
 * Turns the pending memberships for this user's GitHub account into real
 * ones. Idempotent: safe to run on every sign-in.
 */
export const claimPendingMemberships = async (
	db: Db,
	userId: string,
): Promise<number> => {
	const account = await db.query.account.findFirst({
		where: and(
			eq(schema.account.userId, userId),
			eq(schema.account.providerId, "github"),
		),
	});
	if (!account) return 0;

	const pending = await db.query.pendingMember.findMany({
		where: eq(schema.pendingMember.githubId, account.accountId),
	});
	let claimed = 0;
	for (const row of pending) {
		const existing = await db.query.member.findFirst({
			where: and(
				eq(schema.member.organizationId, row.organizationId),
				eq(schema.member.userId, userId),
			),
		});
		if (!existing) {
			await db.insert(schema.member).values({
				id: crypto.randomUUID(),
				organizationId: row.organizationId,
				userId,
				role: row.role,
				createdAt: new Date(),
			});
			claimed += 1;
		}
		await db
			.delete(schema.pendingMember)
			.where(eq(schema.pendingMember.id, row.id));
	}
	return claimed;
};
