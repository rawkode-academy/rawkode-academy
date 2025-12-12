import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

export default function guessTheLogo(): AstroIntegration {
	return {
		name: "@games/guess-the-logo",
		hooks: {
			"astro:config:setup": ({ injectRoute }) => {
				injectRoute({
					pattern: "/games/guess-the-logo",
					entrypoint: fileURLToPath(
						new URL(
							"./website/pages/games/guess-the-logo/index.astro",
							import.meta.url,
						),
					),
				});

				injectRoute({
					pattern: "/api/games/gtl/player",
					entrypoint: fileURLToPath(
						new URL("./website/api/player.ts", import.meta.url),
					),
				});

				injectRoute({
					pattern: "/api/games/gtl/start",
					entrypoint: fileURLToPath(
						new URL("./website/api/start.ts", import.meta.url),
					),
				});

				injectRoute({
					pattern: "/api/games/gtl/guess",
					entrypoint: fileURLToPath(
						new URL("./website/api/guess.ts", import.meta.url),
					),
				});

				injectRoute({
					pattern: "/api/games/gtl/leaderboard",
					entrypoint: fileURLToPath(
						new URL("./website/api/leaderboard.ts", import.meta.url),
					),
				});

				injectRoute({
					pattern: "/api/games/gtl/leaderboard/rank",
					entrypoint: fileURLToPath(
						new URL("./website/api/leaderboard-rank.ts", import.meta.url),
					),
				});

				injectRoute({
					pattern: "/api/games/gtl/technologies",
					entrypoint: fileURLToPath(
						new URL("./website/api/technologies.ts", import.meta.url),
					),
				});
			},
		},
	};
}
