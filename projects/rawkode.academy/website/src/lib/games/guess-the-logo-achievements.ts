export const NAMESPACE = "cnicon";

export interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
}

export interface PlayerStats {
	weeksPlayed: number;
	lastWeekKey: string;
	lastWeekIndex: number;
	currentStreak: number;
	longestStreak: number;
	lifetimeCorrect: number;
	perCategoryCorrect: {
		sandbox: number;
		incubating: number;
		graduated: number;
		archived: number;
		nonCncf: number;
	};
	bestScore: number;
	perfectWeeks: number;
	correctLogos: string[];
	wins: number;
	podiums: number;
	bestRank: number;
	lastCreditedWeek: string;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
	// Streaks / habit
	{
		id: "first-timer",
		name: "First Timer",
		description: "Play your first week.",
		icon: "🌱",
	},
	{
		id: "committed",
		name: "Committed",
		description: "Play 10 or more weeks.",
		icon: "🔥",
	},
	{
		id: "veteran",
		name: "Veteran",
		description: "Play 50 or more weeks.",
		icon: "🏅",
	},
	{
		id: "regular",
		name: "Regular",
		description: "Keep a streak of 4 or more weeks.",
		icon: "🔥",
	},
	{
		id: "devotee",
		name: "Devotee",
		description: "Reach a longest streak of 12 or more weeks.",
		icon: "🔥",
	},
	{
		id: "year-round",
		name: "Year-Round",
		description: "Reach a longest streak of 52 or more weeks.",
		icon: "🔥",
	},
	// Lifetime mastery
	{
		id: "century",
		name: "Century",
		description: "Answer 100 or more logos correctly across all time.",
		icon: "💯",
	},
	{
		id: "polyglot",
		name: "Polyglot",
		description: "Answer 500 or more logos correctly across all time.",
		icon: "📚",
	},
	{
		id: "sandbox-sensei",
		name: "Sandbox Sensei",
		description: "Answer 25 or more Sandbox logos correctly across all time.",
		icon: "🎓",
	},
	{
		id: "incubator",
		name: "Incubator",
		description: "Answer 25 or more Incubating logos correctly across all time.",
		icon: "🎓",
	},
	{
		id: "honor-roll",
		name: "Honor Roll",
		description: "Answer 25 or more Graduated logos correctly across all time.",
		icon: "🎓",
	},
	{
		id: "off-the-map",
		name: "Off the Map",
		description: "Answer 25 or more non-CNCF logos correctly across all time.",
		icon: "🗺️",
	},
	// Competition
	{
		id: "podium",
		name: "Podium",
		description: "Finish in the top 3 in a weekly competition.",
		icon: "🥉",
	},
	{
		id: "champion",
		name: "Champion",
		description: "Finish #1 in a weekly competition.",
		icon: "🥇",
	},
	{
		id: "hat-trick",
		name: "Hat Trick",
		description: "Win 3 or more weekly competitions.",
		icon: "🎩",
	},
	{
		id: "high-roller",
		name: "High Roller",
		description: "Achieve a best score of 5,000 or more in a single week.",
		icon: "📈",
	},
	// Completion
	{
		id: "surveyor",
		name: "Surveyor",
		description: "Correctly identify at least 25% of the logo pool.",
		icon: "🧭",
	},
	{
		id: "cartographer",
		name: "Cartographer",
		description: "Correctly identify at least 50% of the logo pool.",
		icon: "🗺️",
	},
	{
		id: "completionist",
		name: "Completionist",
		description: "Correctly identify every logo in the pool.",
		icon: "🏆",
	},
	// Per-week feats
	{
		id: "flawless",
		name: "Flawless",
		description: "Answer all 5 questions correctly in a single week.",
		icon: "✨",
	},
	{
		id: "speed-run",
		name: "Speed Run",
		description: "Answer every question this week with more than 50% time remaining.",
		icon: "⚡",
	},
];

/**
 * Pure evaluation of which achievements are earned given cumulative player stats
 * and this week's per-run information.
 *
 * @param stats     Cumulative player stats blob (already updated for this week).
 * @param thisWeek  Per-week feats derived from the current submission.
 * @param poolSize  Total number of distinct logos in the active pool.
 * @returns         Array of achievement ids the player has earned (all ever earned,
 *                  not just newly unlocked — the achievements service is idempotent).
 */
export function evaluateAchievements(
	stats: PlayerStats,
	thisWeek: { perfect: boolean; fastWeek: boolean },
	poolSize: number,
): string[] {
	const earned: string[] = [];

	// --- Streaks / habit ---
	if (stats.weeksPlayed >= 1) earned.push("first-timer");
	if (stats.weeksPlayed >= 10) earned.push("committed");
	if (stats.weeksPlayed >= 50) earned.push("veteran");
	if (stats.currentStreak >= 4 || stats.longestStreak >= 4) earned.push("regular");
	if (stats.longestStreak >= 12) earned.push("devotee");
	if (stats.longestStreak >= 52) earned.push("year-round");

	// --- Lifetime mastery ---
	if (stats.lifetimeCorrect >= 100) earned.push("century");
	if (stats.lifetimeCorrect >= 500) earned.push("polyglot");
	if (stats.perCategoryCorrect.sandbox >= 25) earned.push("sandbox-sensei");
	if (stats.perCategoryCorrect.incubating >= 25) earned.push("incubator");
	if (stats.perCategoryCorrect.graduated >= 25) earned.push("honor-roll");
	if (stats.perCategoryCorrect.nonCncf >= 25) earned.push("off-the-map");

	// --- Competition ---
	if (stats.podiums >= 1) earned.push("podium");
	if (stats.wins >= 1) earned.push("champion");
	if (stats.wins >= 3) earned.push("hat-trick");
	if (stats.bestScore >= 5000) earned.push("high-roller");

	// --- Completion ---
	if (poolSize > 0) {
		const seen = stats.correctLogos.length;
		if (seen >= poolSize * 0.25) earned.push("surveyor");
		if (seen >= poolSize * 0.5) earned.push("cartographer");
		if (seen >= poolSize) earned.push("completionist");
	}

	// --- Per-week feats ---
	if (thisWeek.perfect) earned.push("flawless");
	if (thisWeek.fastWeek) earned.push("speed-run");

	return earned;
}
