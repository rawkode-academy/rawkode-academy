export interface CompetitorUsernameRecord {
	id: string;
	seasonId: string;
	personSlug: string;
}

export function planCompetitorUsernameSync(input: {
	competitors: readonly CompetitorUsernameRecord[];
	username: string;
	usernameOwners: readonly CompetitorUsernameRecord[];
}): Array<{ id: string; seasonId: string; personSlug: string }> {
	for (const competitor of input.competitors) {
		const conflict = input.usernameOwners.find(
			(owner) =>
				owner.seasonId === competitor.seasonId &&
				owner.id !== competitor.id,
		);
		if (conflict) {
			throw new Error(
				"GitHub username is already assigned to another competitor in this season",
			);
		}
	}

	return input.competitors
		.filter((competitor) => competitor.personSlug !== input.username)
		.map((competitor) => ({
			id: competitor.id,
			seasonId: competitor.seasonId,
			personSlug: input.username,
		}));
}
