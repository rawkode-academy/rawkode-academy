import type { Comment, OrgLink, Review, Session } from "./types.ts";

/**
 * Everything the portal persists. KV today (one JSON document per key);
 * moves to D1 once the review volume warrants it.
 */
export interface Store {
	listOrgLinks(): Promise<OrgLink[]>;
	putOrgLink(link: OrgLink): Promise<void>;
	deleteOrgLink(orgId: string): Promise<void>;
	listReviews(): Promise<Review[]>;
	getReview(id: string): Promise<Review | null>;
	putReview(review: Review): Promise<void>;
	listComments(reviewId: string): Promise<Comment[]>;
	getComment(id: string): Promise<Comment | null>;
	putComment(comment: Comment): Promise<void>;
	getSession(id: string): Promise<Session | null>;
	putSession(id: string, session: Session): Promise<void>;
	deleteSession(id: string): Promise<void>;
	/** One-use sign-in state: the PKCE verifier for a pending login. */
	putLogin(state: string, verifier: string): Promise<void>;
	takeLogin(state: string): Promise<string | null>;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const LOGIN_TTL_SECONDS = 600;

export class KvStore implements Store {
	constructor(private readonly kv: KVNamespace) {}

	private async list<T>(prefix: string): Promise<T[]> {
		const keys = await this.kv.list({ prefix });
		const values = await Promise.all(keys.keys.map((key) => this.kv.get(key.name, "json")));
		return values.filter((value): value is T => value !== null);
	}

	listOrgLinks() {
		return this.list<OrgLink>("orglink:");
	}
	async putOrgLink(link: OrgLink) {
		await this.kv.put(`orglink:${link.orgId}`, JSON.stringify(link));
	}
	async deleteOrgLink(orgId: string) {
		await this.kv.delete(`orglink:${orgId}`);
	}
	listReviews() {
		return this.list<Review>("review:");
	}
	async getReview(id: string) {
		return (await this.kv.get(`review:${id}`, "json")) as Review | null;
	}
	async putReview(review: Review) {
		await this.kv.put(`review:${review.id}`, JSON.stringify(review));
	}
	async listComments(reviewId: string) {
		const all = await this.list<Comment>("comment:");
		return all
			.filter((comment) => comment.reviewId === reviewId)
			.sort(
				(a, b) =>
					(a.timestampMs ?? Number.MAX_SAFE_INTEGER) - (b.timestampMs ?? Number.MAX_SAFE_INTEGER) ||
					a.createdAt.localeCompare(b.createdAt),
			);
	}
	async getComment(id: string) {
		return (await this.kv.get(`comment:${id}`, "json")) as Comment | null;
	}
	async putComment(comment: Comment) {
		await this.kv.put(`comment:${comment.id}`, JSON.stringify(comment));
	}
	async getSession(id: string) {
		const session = (await this.kv.get(`session:${id}`, "json")) as Session | null;
		return session && session.expiresAt > Date.now() ? session : null;
	}
	async putSession(id: string, session: Session) {
		await this.kv.put(`session:${id}`, JSON.stringify(session), {
			expirationTtl: SESSION_TTL_SECONDS,
		});
	}
	async deleteSession(id: string) {
		await this.kv.delete(`session:${id}`);
	}
	async putLogin(state: string, verifier: string) {
		await this.kv.put(`login:${state}`, verifier, { expirationTtl: LOGIN_TTL_SECONDS });
	}
	async takeLogin(state: string) {
		const verifier = await this.kv.get(`login:${state}`);
		if (verifier) await this.kv.delete(`login:${state}`);
		return verifier;
	}
}
