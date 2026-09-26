import type { GameId } from "./game-catalogue";

/** Only team-operated collection games accept multiple submissions per prompt. */
export function allowsMultipleSubmissions(
	role: "audience" | "contestant" | "display",
	game: GameId,
): boolean {
	return role === "contestant" && (game === "merge-conflict" || game === "ten-nines");
}
