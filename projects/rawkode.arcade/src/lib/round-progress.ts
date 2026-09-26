import type { RoomPhase } from "./live-contract";

type SafeRound = { index?: unknown; total?: unknown; phase?: unknown };

/** Converts the server's safe 0-based round projection into browser display state. */
export function projectRoundProgress(
	round: SafeRound | undefined,
	fallbackPhase: unknown,
): Pick<PublicRoundProgress, "questionNumber" | "questionTotal" | "phase"> {
	const total =
		typeof round?.total === "number" &&
		Number.isSafeInteger(round.total) &&
		round.total > 0
			? round.total
			: 0;
	const index =
		typeof round?.index === "number" &&
		Number.isSafeInteger(round.index) &&
		round.index >= 0 &&
		round.index < total
			? round.index
			: 0;
	const value = typeof round?.phase === "string" ? round.phase : fallbackPhase;
	const phase: RoomPhase =
		value === "complete"
			? "complete"
			: value === "lobby" || value === "setup"
				? "lobby"
				: value === "reveal" || value === "revealed"
					? "reveal"
					: value === "round"
						? "round"
						: "question";
	return { questionNumber: total ? index + 1 : 0, questionTotal: total, phase };
}

type PublicRoundProgress = {
	questionNumber: number;
	questionTotal: number;
	phase: RoomPhase;
};
