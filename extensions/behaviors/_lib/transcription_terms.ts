/**
 * Pure rules for keeping the `transcription_terms` table of the
 * `platform-transcription-terms` D1 database in step with the names that
 * technologies and people have. Nothing here performs I/O: the behavior is
 * handed the rows and decides what to insert.
 *
 * @module
 */

/** The kinds of term this synchronisation derives from a source table. */
export const SYNCHRONISED_KINDS = ["technology", "person"] as const;

/** One of {@link SYNCHRONISED_KINDS}. */
export type Kind = typeof SYNCHRONISED_KINDS[number];

/** A row of `transcription_terms`. */
export interface Term {
	kind: string;
	foreignId: string;
	term: string;
}

/** A technology or person and the spellings its names give. */
export interface Entity {
	kind: Kind;
	id: string;
	terms: string[];
}

/** A parameterised statement for the D1 query API. */
export interface Statement {
	sql: string;
	params: string[];
}

/** What a run would insert, and what it found without a matching entity. */
export interface Synchronisation {
	missing: Term[];
	orphaned: Term[];
	/** Entities examined, per kind, after the identifier filter. */
	examined: Record<string, number>;
	/** Requested identifiers that match no entity of the kinds in scope. */
	unknown: string[];
}

// D1 binds at most 100 parameters per statement; a term takes three.
const TERMS_PER_STATEMENT = 30;

// A surname this short ("Li", "Xu") is too ambiguous to help on its own.
const SHORTEST_USEFUL_PART = 3;

function text(value: unknown): string {
	return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/**
 * How the consumers compare terms: the transcription workflow trims each
 * keyterm and drops repeats case-insensitively, so two spellings that differ
 * only in case add nothing.
 */
export function comparable(term: string): string {
	return text(term).toLocaleLowerCase();
}

function distinct(terms: string[]): string[] {
	const seen = new Set<string>();
	return terms.filter((term) => {
		const key = comparable(term);
		if (key === "" || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** A JSON string array as D1 returns it (text), or already parsed. */
function stringList(value: unknown): string[] {
	let list = value;
	if (typeof list === "string") {
		try {
			list = JSON.parse(list);
		} catch {
			return [];
		}
	}
	return Array.isArray(list) ? list.map(text) : [];
}

/** The spellings of a technology row: its name, then each alias. */
export function technologyTerms(row: Record<string, unknown>): string[] {
	return distinct([text(row.name), ...stringList(row.aliases)]);
}

/**
 * The spellings of a person row: the display name, the forename and surname
 * together when that differs, and the surname alone. A forename alone is left
 * out: it is rarely distinctive and is covered by the full name.
 */
export function personTerms(row: Record<string, unknown>): string[] {
	const surname = text(row.surname);
	return distinct([
		text(row.name),
		text(`${text(row.forename)} ${surname}`),
		surname.length >= SHORTEST_USEFUL_PART ? surname : "",
	]);
}

/** Split a comma-separated input into its entries. */
export function split(list: string): string[] {
	return list.split(",").map((entry) => entry.trim()).filter(Boolean);
}

/** The kinds a run covers; an empty input covers every synchronised kind. */
export function parseKinds(list: string): Kind[] {
	const requested = split(list);
	const unsupported = requested.filter((kind) =>
		!SYNCHRONISED_KINDS.includes(kind as Kind)
	);
	if (unsupported.length > 0) {
		throw new Error(
			`Unsupported kinds: ${unsupported.join(", ")} (supported: ${
				SYNCHRONISED_KINDS.join(", ")
			})`,
		);
	}
	return requested.length === 0
		? [...SYNCHRONISED_KINDS]
		: SYNCHRONISED_KINDS.filter((kind) => requested.includes(kind));
}

/** Turn source rows into entities; rows without an id are dropped. */
export function toEntities(
	kind: Kind,
	rows: Array<Record<string, unknown>>,
): Entity[] {
	const terms = kind === "technology" ? technologyTerms : personTerms;
	return rows
		.filter((row) => text(row.id) !== "")
		.map((row) => ({ kind, id: String(row.id), terms: terms(row) }));
}

/** Read `transcription_terms` rows, whichever case the id column arrives in. */
export function toTerms(rows: Array<Record<string, unknown>>): Term[] {
	return rows.map((row) => ({
		kind: String(row.kind),
		foreignId: String(row.foreignId ?? row.foreign_id),
		term: String(row.term),
	}));
}

/**
 * Compare the entities with the stored terms. `missing` holds every spelling
 * of an in-scope entity that is not stored yet, ignoring case; `orphaned`
 * holds stored terms of the kinds in scope whose `foreignId` matches no
 * entity of that kind. Orphans are judged against every entity, not only the
 * requested identifiers, and are only reported.
 */
export function synchronise(
	entities: Entity[],
	existing: Term[],
	kinds: Kind[],
	identifiers: string[],
): Synchronisation {
	const inKinds = entities.filter((entity) => kinds.includes(entity.kind));
	const known = new Set(
		inKinds.map((entity) => `${entity.kind}\n${entity.id}`),
	);
	const stored = new Set(
		existing.map((term) =>
			`${term.kind}\n${term.foreignId}\n${comparable(term.term)}`
		),
	);
	const scoped = identifiers.length === 0
		? inKinds
		: inKinds.filter((entity) => identifiers.includes(entity.id));

	const examined: Record<string, number> = {};
	const missing: Term[] = [];
	for (const entity of scoped) {
		examined[entity.kind] = (examined[entity.kind] ?? 0) + 1;
		for (const term of entity.terms) {
			if (!stored.has(`${entity.kind}\n${entity.id}\n${comparable(term)}`)) {
				missing.push({ kind: entity.kind, foreignId: entity.id, term });
			}
		}
	}

	return {
		missing,
		orphaned: existing.filter((term) =>
			kinds.includes(term.kind as Kind) &&
			!known.has(`${term.kind}\n${term.foreignId}`)
		),
		examined,
		unknown: identifiers.filter((id) =>
			!scoped.some((entity) => entity.id === id)
		),
	};
}

/**
 * `INSERT OR IGNORE` statements for the missing terms, several rows each so
 * the batch stays small. Nothing is ever updated or deleted.
 */
export function buildStatements(missing: Term[]): Statement[] {
	const statements: Statement[] = [];
	for (let start = 0; start < missing.length; start += TERMS_PER_STATEMENT) {
		const terms = missing.slice(start, start + TERMS_PER_STATEMENT);
		statements.push({
			sql:
				"INSERT OR IGNORE INTO transcription_terms (kind, foreignId, term) VALUES " +
				terms.map((_, index) =>
					`(?${index * 3 + 1}, ?${index * 3 + 2}, ?${index * 3 + 3})`
				).join(", "),
			params: terms.flatMap((term) => [term.kind, term.foreignId, term.term]),
		});
	}
	return statements;
}

/** The planned terms that are not stored exactly as planned. */
export function notStored(planned: Term[], stored: Term[]): Term[] {
	const present = new Set(
		stored.map((term) => `${term.kind}\n${term.foreignId}\n${term.term}`),
	);
	return planned.filter((term) =>
		!present.has(`${term.kind}\n${term.foreignId}\n${term.term}`)
	);
}

function grouped(terms: Term[]): string[] {
	const groups = new Map<string, string[]>();
	for (const term of terms) {
		const key = `${term.kind} ${term.foreignId}`;
		groups.set(key, [...(groups.get(key) ?? []), term.term]);
	}
	return [...groups].map(([key, values]) => `  ${key}: ${values.join(", ")}`);
}

/** A readable account of the plan for whoever approves it. */
export function summarise(synchronisation: Synchronisation): string {
	const { missing, orphaned } = synchronisation;
	const lines: string[] = [];
	if (missing.length > 0) {
		lines.push(`To insert (${missing.length}):`, ...grouped(missing));
	} else {
		lines.push("Every name is already a transcription term; nothing to write.");
	}
	if (orphaned.length > 0) {
		lines.push(
			`Orphaned, reported only (${orphaned.length}):`,
			...grouped(orphaned),
		);
	}
	return lines.join("\n");
}
