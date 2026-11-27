// A partner's own numbers for /analytics: the videos made with their company,
// for a signed-in member of the company's organisation. Which organisations a
// user belongs to comes from identity (service binding only); which videos are
// the company's comes from the public API; the figures come from the daily
// snapshot. The arithmetic is shared with the GraphQL field
// Collaborator.analytics (packages/guest-scope/partner.ts), so the portal and
// this page agree.
import {
	analyticsFor,
	type CollaboratorAnalytics,
} from "../../../../../../packages/guest-scope/partner";
import type { Snapshot } from "@/lib/analytics/snapshot";
import type { ContentEnv } from "@/lib/live-content/env";
import { queryGateway } from "@/lib/live-content/gateway";

export type PartnerAnalytics = { name: string; analytics: CollaboratorAnalytics };

const COLLABORATORS = `query PartnerVideos { collaborators { id name organizationId videos { id } } }`;

type Membership = { id: string; role: string };

async function organisationsOf(
	identity: Fetcher | undefined,
	userId: string,
): Promise<Set<string>> {
	if (!identity) return new Set();
	const response = await identity.fetch(
		`https://internal/api/internal/memberships?user=${encodeURIComponent(userId)}`,
	);
	if (!response.ok) return new Set();
	const body = (await response.json()) as { orgs?: Membership[] };
	return new Set((body.orgs ?? []).map((org) => org.id));
}

/** Empty when the user belongs to no partner organisation. */
export async function partnerAnalytics(
	env: ContentEnv & { IDENTITY?: Fetcher },
	snapshot: Snapshot,
	userId: string,
): Promise<PartnerAnalytics[]> {
	const orgs = await organisationsOf(env.IDENTITY, userId);
	if (orgs.size === 0) return [];
	const data = await queryGateway<{
		collaborators: {
			name: string;
			organizationId: string | null;
			videos: { id: string }[];
		}[];
	}>(env, COLLABORATORS);
	return data.collaborators
		.filter((c) => c.organizationId !== null && orgs.has(c.organizationId))
		.map((c) => ({
			name: c.name,
			analytics: analyticsFor(
				snapshot,
				c.videos.map((video) => video.id),
			),
		}));
}
