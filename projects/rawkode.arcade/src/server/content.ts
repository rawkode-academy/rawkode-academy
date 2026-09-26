import { games, type GameDefinition, validatePublishedContent } from "../domain/registry";
import type { Env } from "../env";
import { randomId } from "./crypto";

export interface ContentQuestionInput {
	kind: string;
	prompt: string;
	options?: unknown;
	answer: unknown;
	assetId?: string;
	validation?: Record<string, unknown>;
	tags?: string[];
}

export interface ContentPackInput { gameKey: string; slug: string; title: string; description?: string; }
export interface PublishedRoomContent { revisionId: string; checksum: string; manifest: Record<string, unknown>; questions: Array<{ id: string; ordinal: number; kind: string; prompt: string; options: unknown; answer: unknown }>; }
export class ContentValidationError extends Error {}

async function checksum(value: string): Promise<string> {
	return checksumBytes(new TextEncoder().encode(value));
}

async function checksumBytes(value: BufferSource): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", value);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** D1 stores content metadata and revisions; immutable media lives in R2. */
export class ContentRepository {
	constructor(private readonly env?: Env) {}
	listGames(): GameDefinition[] { return Object.values(games); }
	getGame(key: string): GameDefinition | undefined { return games[key as keyof typeof games]; }

	private database(): D1Database {
		if (!this.env) throw new Error("ContentRepository requires Cloudflare bindings for persistence");
		return this.env.DB;
	}

	async listPacks(gameKey?: string): Promise<Array<Record<string, unknown>>> {
		const database = this.database();
		const statement = gameKey
			? database.prepare("SELECT id, game_key, slug, title, description, status, published_revision_id, updated_at FROM arcade_content_packs WHERE game_key = ? ORDER BY updated_at DESC").bind(gameKey)
			: database.prepare("SELECT id, game_key, slug, title, description, status, published_revision_id, updated_at FROM arcade_content_packs ORDER BY updated_at DESC");
		return (await statement.all<Record<string, unknown>>()).results;
	}

	async getPack(id: string): Promise<Record<string, unknown> | undefined> {
		return (await this.database().prepare("SELECT id, game_key, slug, title, description, status, published_revision_id, created_at, updated_at FROM arcade_content_packs WHERE id = ?").bind(id).first<Record<string, unknown>>()) ?? undefined;
	}

	async updatePack(id: string, input: Pick<ContentPackInput, "title" | "description">): Promise<void> {
		if (!input.title?.trim() || input.title.length > 160) throw new ContentValidationError("title is required and must be at most 160 characters");
		const result = await this.database().prepare("UPDATE arcade_content_packs SET title = ?, description = ?, updated_at = ? WHERE id = ? AND status != 'archived'")
			.bind(input.title.trim(), input.description?.trim() ?? "", new Date().toISOString(), id).run();
		if (!result.meta.changes) throw new ContentValidationError("Pack does not exist or is archived");
	}

	async archivePack(id: string): Promise<void> {
		const result = await this.database().prepare("UPDATE arcade_content_packs SET status = 'archived', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
		if (!result.meta.changes) throw new ContentValidationError("Pack does not exist");
	}

	async getRevision(id: string): Promise<Record<string, unknown> | undefined> {
		const revision = await this.database().prepare("SELECT id, pack_id, revision_number, status, manifest_json, checksum, created_at, published_at FROM arcade_content_revisions WHERE id = ?").bind(id).first<Record<string, unknown>>();
		return revision ?? undefined;
	}

	/** Returns an immutable published revision snapshot for Durable Object init. */
	async publishedRoomContent(gameKey: string, revisionId?: string): Promise<PublishedRoomContent | undefined> {
		const database = this.database();
		const revision = revisionId
			? await database.prepare("SELECT r.id, r.checksum, r.manifest_json FROM arcade_content_revisions r JOIN arcade_content_packs p ON p.id = r.pack_id WHERE r.id = ? AND r.status = 'published' AND p.game_key = ? AND p.status = 'published'").bind(revisionId, gameKey).first<{ id: string; checksum: string; manifest_json: string }>()
			: await database.prepare("SELECT r.id, r.checksum, r.manifest_json FROM arcade_content_packs p JOIN arcade_content_revisions r ON r.id = p.published_revision_id WHERE p.game_key = ? AND p.status = 'published' AND r.status = 'published' ORDER BY p.updated_at DESC LIMIT 1").bind(gameKey).first<{ id: string; checksum: string; manifest_json: string }>();
		if (!revision) return undefined;
		const questions = await database.prepare("SELECT id, ordinal, kind, prompt, options_json, answer_json FROM arcade_content_questions WHERE revision_id = ? ORDER BY ordinal").bind(revision.id).all<{ id: string; ordinal: number; kind: string; prompt: string; options_json: string | null; answer_json: string }>();
		return { revisionId: revision.id, checksum: revision.checksum, manifest: JSON.parse(revision.manifest_json) as Record<string, unknown>, questions: questions.results.map((question) => ({ id: question.id, ordinal: question.ordinal, kind: question.kind, prompt: question.prompt, options: question.options_json ? JSON.parse(question.options_json) : undefined, answer: JSON.parse(question.answer_json) })) };
	}

	async createPack(input: ContentPackInput, operatorId: string): Promise<{ id: string }> {
		if (!this.getGame(input.gameKey)) throw new ContentValidationError("Unknown game key");
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 80) throw new ContentValidationError("slug must be lowercase kebab-case");
		if (!input.title.trim() || input.title.length > 160) throw new ContentValidationError("title is required and must be at most 160 characters");
		const id = randomId("pack"); const now = new Date().toISOString();
		await this.database().prepare("INSERT INTO arcade_content_packs (id, game_key, slug, title, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
			.bind(id, input.gameKey, input.slug, input.title.trim(), input.description?.trim() ?? "", operatorId, now, now).run();
		return { id };
	}

	async createRevision(packId: string, questions: ContentQuestionInput[], operatorId: string, manifest: Record<string, unknown> = {}): Promise<{ id: string; revisionNumber: number; checksum: string }> {
		if (!questions.length || questions.length > 500) throw new ContentValidationError("A revision requires between 1 and 500 questions");
		for (const [index, question] of questions.entries()) this.validateQuestion(question, index);
		const database = this.database();
		if (!(await database.prepare("SELECT id FROM arcade_content_packs WHERE id = ?").bind(packId).first<{ id: string }>())) throw new ContentValidationError("Pack does not exist");
		for (const question of questions) if (question.assetId && !(await database.prepare("SELECT id FROM arcade_content_assets WHERE id = ?").bind(question.assetId).first<{ id: string }>())) throw new ContentValidationError(`Asset ${question.assetId} does not exist`);
		const max = await database.prepare("SELECT COALESCE(MAX(revision_number), 0) AS value FROM arcade_content_revisions WHERE pack_id = ?").bind(packId).first<{ value: number }>();
		const revisionNumber = (max?.value ?? 0) + 1;
		const id = randomId("revision"); const normalizedManifest = JSON.stringify({ ...manifest, questionCount: questions.length });
		const revisionChecksum = await checksum(JSON.stringify({ normalizedManifest, questions })); const now = new Date().toISOString();
		const statements: D1PreparedStatement[] = [database.prepare("INSERT INTO arcade_content_revisions (id, pack_id, revision_number, status, manifest_json, checksum, created_by, created_at) VALUES (?, ?, ?, 'validated', ?, ?, ?, ?)")
			.bind(id, packId, revisionNumber, normalizedManifest, revisionChecksum, operatorId, now)];
		for (const [ordinal, question] of questions.entries()) statements.push(database.prepare("INSERT INTO arcade_content_questions (id, revision_id, ordinal, kind, prompt, options_json, answer_json, asset_id, validation_json, tags_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			.bind(randomId("question"), id, ordinal, question.kind, question.prompt.trim(), question.options === undefined ? null : JSON.stringify(question.options), JSON.stringify(question.answer), question.assetId ?? null, JSON.stringify(question.validation ?? {}), JSON.stringify(question.tags ?? [])));
		await database.batch(statements);
		return { id, revisionNumber, checksum: revisionChecksum };
	}

	async publishRevision(revisionId: string, operatorId: string): Promise<void> {
		const database = this.database();
		const revision = await database.prepare("SELECT r.id, r.pack_id, r.status, r.checksum, r.manifest_json, p.game_key FROM arcade_content_revisions r JOIN arcade_content_packs p ON p.id = r.pack_id WHERE r.id = ?").bind(revisionId).first<{ id: string; pack_id: string; status: string; checksum: string; manifest_json: string; game_key: string }>();
		if (!revision || revision.status !== "validated") throw new ContentValidationError("Only a validated revision can be published");
		const questions = await database.prepare("SELECT id, ordinal, kind, prompt, options_json, answer_json FROM arcade_content_questions WHERE revision_id = ? ORDER BY ordinal").bind(revisionId).all<{ id: string; ordinal: number; kind: string; prompt: string; options_json: string | null; answer_json: string }>();
		if (!questions.results.length) throw new ContentValidationError("A published revision needs a question");
		const reducerValidation = validatePublishedContent(revision.game_key, { revisionId: revision.id, checksum: revision.checksum, manifest: JSON.parse(revision.manifest_json) as Record<string, unknown>, questions: questions.results.map((question) => ({ id: question.id, ordinal: question.ordinal, kind: question.kind, prompt: question.prompt, options: question.options_json ? JSON.parse(question.options_json) : undefined, answer: JSON.parse(question.answer_json) })) });
		if (!reducerValidation.valid) throw new ContentValidationError(`Reducer content is invalid: ${reducerValidation.errors.join(", ")}`);
		const now = new Date().toISOString();
		await database.batch([
			database.prepare("UPDATE arcade_content_revisions SET status = 'published', published_at = ? WHERE id = ?").bind(now, revisionId),
			database.prepare("UPDATE arcade_content_packs SET status = 'published', published_revision_id = ?, updated_at = ? WHERE id = ?").bind(revisionId, now, revision.pack_id),
			database.prepare("INSERT INTO arcade_audit_log (id, actor_id, action, resource_type, resource_id, created_at) VALUES (?, ?, 'content.revision.publish', 'content_revision', ?, ?)").bind(randomId("audit"), operatorId, revisionId, now),
		]);
	}

	async putAsset(body: ArrayBuffer, contentType: string, operatorId: string): Promise<{ id: string; r2Key: string; sha256: string }> {
		if (!contentType || contentType.length > 128 || body.byteLength > 20 * 1024 * 1024) throw new ContentValidationError("Asset metadata or size is invalid");
		if (!this.env) throw new Error("ContentRepository requires Cloudflare bindings for assets");
		const digest = await checksumBytes(body); const id = randomId("asset"); const r2Key = `content/${digest}`;
		await this.env.ARCADE_ASSETS.put(r2Key, body, { httpMetadata: { contentType } });
		await this.database().prepare("INSERT INTO arcade_content_assets (id, r2_key, content_type, byte_size, sha256, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
			.bind(id, r2Key, contentType, body.byteLength, digest, operatorId, new Date().toISOString()).run();
		return { id, r2Key, sha256: digest };
	}

	private validateQuestion(question: ContentQuestionInput, index: number): void {
		if (!question.kind || question.kind.length > 64 || !question.prompt?.trim() || question.prompt.length > 2_000) throw new ContentValidationError(`Question ${index + 1} has invalid kind or prompt`);
		if (question.answer === undefined) throw new ContentValidationError(`Question ${index + 1} has no answer`);
		if (question.kind === "multiple-choice" && (!Array.isArray(question.options) || question.options.length < 2)) throw new ContentValidationError(`Question ${index + 1} needs at least two options`);
		if ((question.tags ?? []).some((tag) => tag.length > 64)) throw new ContentValidationError(`Question ${index + 1} has an invalid tag`);
	}
}
