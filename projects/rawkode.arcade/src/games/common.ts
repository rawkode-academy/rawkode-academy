/** Framework-independent contract for deterministic Rawkode Arcade games. */
export type ActorRole = "host" | "team" | "audience";

export interface GameActor {
	id: string;
	role: ActorRole;
	teamId?: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export interface GameDefinition<Content, State, Command> {
	id: string;
	name: string;
	createState: (content: Content) => State;
	redact: (state: State, role: ActorRole) => unknown;
	handle: (state: State, command: Command, actor: GameActor, now: number) => State;
	validateContent: (content: Content) => ValidationResult;
}

export const normalizeAnswer = (value: string): string =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");

export const matchesAnswer = (value: string, answer: string, aliases: string[] = []): boolean => {
	const candidate = normalizeAnswer(value);
	return [answer, ...aliases].some((accepted) => normalizeAnswer(accepted) === candidate);
};

export const isHost = (actor: GameActor): boolean => actor.role === "host";
export const hasTeam = (actor: GameActor): actor is GameActor & { teamId: string } =>
	actor.role === "team" && Boolean(actor.teamId);

export const score = (scores: Record<string, number>, teamId: string, points: number): Record<string, number> => ({
	...scores,
	[teamId]: (scores[teamId] ?? 0) + points,
});

export const validation = (...errors: string[]): ValidationResult => ({
	valid: errors.length === 0,
	errors,
});

/** State reducers return the existing object for ignored/unauthorised commands. */
export const next = <T>(state: T, patch: Partial<T>): T => ({ ...state, ...patch });
