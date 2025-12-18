interface AnalyticsService {
	trackMetric(
		name: string,
		value: number,
		attributes: Record<string, string>,
	): Promise<{ success: boolean; error?: string }>;
}

interface Env {
	ANALYTICS: AnalyticsService;
}

const REPOSITORIES = [
	"alteran-social/alteran",
	"cuenv/cuenv",
	"rawkode-academy/rawkode-academy",
];

export default {
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	): Promise<void> {
		for (const repo of REPOSITORIES) {
			const stars = await fetchStarCount(repo);
			if (stars !== null) {
				ctx.waitUntil(
					env.ANALYTICS.trackMetric("github.stars", stars, { repository: repo }),
				);
			} else {
				console.error(`Failed to fetch stars for ${repo}`);
			}
		}
	},
};

async function fetchStarCount(repo: string): Promise<number | null> {
	const response = await fetch(`https://api.github.com/repos/${repo}`, {
		headers: { "User-Agent": "star-catcher" },
	});
	if (!response.ok) {
		console.error(`GitHub API error for ${repo}:`, response.status);
		return null;
	}
	const data = (await response.json()) as { stargazers_count: number };
	return data.stargazers_count;
}
