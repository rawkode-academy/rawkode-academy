export interface TransferSeason {
	id: string;
	showId: string;
	slug: string;
}

export interface TransferBracket {
	id: string;
	seasonId: string;
	slug: string;
	name: string;
	kind: "solo" | "team";
	format: "single_elimination";
	maxEntries: number;
	teamSize: number;
	cadenceDays: number;
}

export interface TransferApplication {
	bracketId: string;
	competitorId: string;
}

export interface SeasonTransferPlan {
	applicationsMoved: number;
	competitorIds: string[];
	bracketMappings: Array<{
		sourceBracketId: string;
		targetBracketId: string;
		targetBracket: TransferBracket;
	}>;
	seasonStartDate: number;
	bracketStartsAt: number;
	sourceSeasonId: string;
	targetSeasonId: string;
}

export function planSummerToWinterTransfer(input: {
	sourceSeason: TransferSeason;
	targetSeason: TransferSeason;
	sourceBrackets: TransferBracket[];
	targetBrackets: TransferBracket[];
	applications: TransferApplication[];
	sourceCompetitorIds: string[];
	targetCompetitorCount: number;
	targetApplicationCount: number;
	unsupportedRelatedRecords: string[];
	seasonStartDate: number;
	bracketStartsAt: number;
	createBracketId?: () => string;
}): SeasonTransferPlan {
	const { sourceSeason, targetSeason } = input;
	if (
		sourceSeason.showId !== "klustered" ||
		targetSeason.showId !== sourceSeason.showId ||
		sourceSeason.slug !== "s26" ||
		targetSeason.slug !== "w26"
	) {
		throw new Error("Only the Klustered Summer 2026 to Winter 2026 transfer is supported");
	}
	if (sourceSeason.id === targetSeason.id) {
		throw new Error("Source and target seasons must be different");
	}
	if (
		!Number.isSafeInteger(input.seasonStartDate) ||
		!Number.isSafeInteger(input.bracketStartsAt) ||
		input.seasonStartDate <= 0 ||
		input.bracketStartsAt < input.seasonStartDate ||
		new Date(input.seasonStartDate).toISOString().slice(0, 10) !==
			new Date(input.bracketStartsAt).toISOString().slice(0, 10)
	) {
		throw new Error("Enter a valid Winter start date and bracket start time on the same UTC day");
	}
	if (input.applications.length === 0) {
		throw new Error("Summer has no applications to move");
	}
	if (input.targetCompetitorCount > 0 || input.targetApplicationCount > 0) {
		throw new Error(
			"Winter already has competitors or applications; resolve those before transferring Summer",
		);
	}
	if (input.targetBrackets.length > 0) {
		throw new Error("Winter already has brackets; review them before transferring Summer");
	}
	if (input.unsupportedRelatedRecords.length > 0) {
		throw new Error(
			"Summer contains related competition data that this transfer will not delete: " +
				input.unsupportedRelatedRecords.join(", "),
		);
	}

	const applicationCompetitors = new Set(input.applications.map((row) => row.competitorId));
	if (
		applicationCompetitors.size !== input.sourceCompetitorIds.length ||
		input.sourceCompetitorIds.some((id) => !applicationCompetitors.has(id))
	) {
		throw new Error("Summer has competitor profiles not represented by its applications");
	}

	const sourceBracketById = new Map(
		input.sourceBrackets.map((bracket) => [bracket.id, bracket]),
	);
	const applicationsByBracket = new Set(
		input.applications.map((application) => application.bracketId),
	);
	const bracketMappings: SeasonTransferPlan["bracketMappings"] = [];
	const makeId = input.createBracketId ?? (() => `bracket-${crypto.randomUUID()}`);

	for (const sourceBracketId of applicationsByBracket) {
		const sourceBracket = sourceBracketById.get(sourceBracketId);
		if (!sourceBracket) throw new Error("An application is not attached to a Summer bracket");

		const targetBracket: TransferBracket = {
			...sourceBracket,
			id: makeId(),
			seasonId: targetSeason.id,
		};
		bracketMappings.push({
			sourceBracketId,
			targetBracketId: targetBracket.id,
			targetBracket,
		});
	}

	return {
		applicationsMoved: input.applications.length,
		competitorIds: [...applicationCompetitors],
		bracketMappings,
		seasonStartDate: input.seasonStartDate,
		bracketStartsAt: input.bracketStartsAt,
		sourceSeasonId: sourceSeason.id,
		targetSeasonId: targetSeason.id,
	};
}
