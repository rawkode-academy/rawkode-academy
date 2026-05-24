// Pure scheduling helpers shared by the generate and advance workflows.
// Match times start at the bracket's startsAt and step by cadenceDays,
// skipping any configured bracket breaks.

type BracketSchedule = {
	startsAt: Date | null;
	cadenceDays: number;
};

type BracketBreak = {
	startsAt: Date;
	endsAt: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isInsideBreak(value: Date, breaks: BracketBreak[]): boolean {
	const time = value.getTime();
	return breaks.some(
		(b) => time >= b.startsAt.getTime() && time <= b.endsAt.getTime(),
	);
}

export function scheduledAtForSlot(
	bracket: BracketSchedule,
	breaks: BracketBreak[],
	slotIndex: number,
): Date | null {
	if (!bracket.startsAt) return null;
	const cadenceDays = bracket.cadenceDays > 0 ? bracket.cadenceDays : 7;

	let candidate = new Date(bracket.startsAt);
	for (let index = 0; index <= slotIndex; index++) {
		if (index > 0) {
			candidate = new Date(candidate.getTime() + cadenceDays * DAY_MS);
		}
		while (isInsideBreak(candidate, breaks)) {
			candidate = new Date(candidate.getTime() + cadenceDays * DAY_MS);
		}
	}

	return candidate;
}
