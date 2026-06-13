# Guess the Logo — Design Spec

Date: 2026-06-13
Status: Approved (building)

## Summary

A logged-in, **daily** Wordle-style mini-game on the Rawkode Academy website.
Every UTC day there is **one shared puzzle**: the same 10 technology logos, in
the same order, with the same 4 options each, for **every** player. Each logo is
rendered with the restored CRT **scan-line duotone** effect (the logo is
obscured). For each logo the player picks from 4 answers (1 correct + 3
distractors) under a 15-second timer; running out of time counts as wrong. After
each answer the logo reveals to full colour, then auto-advances. A final screen
shows the score (X/10), submits to that **day's leaderboard**, awards CNCF-themed
achievements, and shows the top players for the day.

**One attempt per day.** A player's first submission for the day is the one that
counts; the page shows the results + daily leaderboard if they have already
played today. This drives daily return visits and shareable competition.

Two new **generic, reusable** platform services back this: a `leaderboard` and
an `achievements` service, both keyed by a `namespace` so any future game or
service can reuse them. Game-specific definitions/criteria live in the game, not
the services.

## Source of the scan-line effect

Ported from the removed `website/src/components/hero/Typewriter.astro`
(commit `b032fd2c4`). Two mask layers driven by a `--icon-url` custom property —
cyan `#00ceff` in `alpha` mode at 0.28 opacity + purple `#5f5ed7` in `luminance`
mode — under an animated `repeating-linear-gradient` scanline mask
(`scanline-scroll` keyframes, 2px on / 2px off, 4px cycle). Full-colour logo sits
underneath at opacity 0. **Reveal trigger changes from `:hover` to a `.revealed`
class** toggled after the player answers. Respects `prefers-reduced-motion`.

## Technologies data

231 of the technology content entries ship an `icon.svg`. Resolve the per-entry
URL with the existing build-time helper
`@/utils/resolve-technology-icon` → `resolveTechnologyIconUrl(entry.id, entry.data.logos)`.
Each logo also carries its CNCF maturity from frontmatter `cncf.status`
(`graduated | incubating | sandbox | archived`) or `null` when absent.

`type Logo = { name: string; iconUrl: string; cncfStatus: "graduated" | "incubating" | "sandbox" | "archived" | null }`

The page builds the pool of logos that have an icon and passes it to the client.

## Daily puzzle mechanic

- The "day" is a UTC calendar date string `YYYY-MM-DD`, derived **server-side**
  (in the `.astro` page and in the API routes) so all players share it and the
  client cannot spoof it.
- The 10 rounds are generated **deterministically** from the date: a seeded PRNG
  (no `Math.random`) seeds off the date string; the pool is sorted by a stable
  key (technology id) before selection so the same date always yields the same
  10 logos, the same order, and the same 4 options — across every player and
  every deploy.
- The page builds the day's rounds server-side and passes `{ date, rounds }` to
  the client (Wordle embeds its answer client-side too; this is acceptable for a
  casual daily game).
- Per-day leaderboard: scores are stored under `scoreType = "daily-" + date`, so
  each day is its own board within the `guess-the-logo` namespace.
- One attempt per day is enforced server-side: the score route refuses to
  overwrite an existing entry for the day (`onlyIfAbsent`), and a status endpoint
  lets the page show results immediately if the player already played today.

## Auth

Mirror `secret-of-kubernetes-island`: middleware sets `Astro.locals.user`
(production only; dev bypasses). `DISABLE_GAME_AUTH` (already declared in
`astro:env/server` and set in `env.cue`) bypasses auth in dev. If no user and
auth is not disabled, the page renders a sign-in CTA linking to
`/api/auth/sign-in?returnTo=/games/guess-the-logo`. Score/achievement submission
is skipped client-side when `disableAuth` is true.

---

## Generic platform service: leaderboard

Location: `projects/rawkode.academy/platform/leaderboard/`
Worker name (codegen-derived): `platform-leaderboard-rpc`. Entrypoint class:
`Leaderboard` (PascalCase of serviceName). Website binding: `LEADERBOARD`.
D1 database id: `20f8fa9e-58b7-45e6-b8d6-d961f1ba84b0`.

Hand-written (committed) files; everything else (`package.json`, `tsconfig.json`,
`biome.json`, `README.md`, `drizzle.config.ts`, `http/wrangler.jsonc`,
`http/main.ts`) is cuenv-generated and gitignored — replicate the SKI
leaderboard's `.gitignore` verbatim.

### service.cue
```cue
package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

_service: gen.#PlatformService & {
	serviceName:      "leaderboard"
	servicePrefix:    "platform"
	includeReadModel: false
	includeHttp:      true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "leaderboard"
			databaseId:   "20f8fa9e-58b7-45e6-b8d6-d961f1ba84b0"
		}]
	}
}

codegen: _service.codegen
```

### env.cue
Mirror the SKI leaderboard `env.cue`; set `name: "rawkode-academy-platform-leaderboard"`.

### data-model/schema.ts
```ts
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leaderboardEntriesTable = sqliteTable(
	"leaderboard_entries",
	{
		id: text("id").primaryKey(),
		namespace: text("namespace").notNull(),
		personId: text("person_id").notNull(),
		personName: text("person_name"),
		scoreType: text("score_type").notNull(),
		scoreValue: integer("score_value").notNull(),
		achievedAt: integer("achieved_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		boardIdx: index("leaderboard_board_idx").on(
			table.namespace,
			table.scoreType,
			table.scoreValue,
		),
		personIdx: index("leaderboard_person_idx").on(
			table.namespace,
			table.personId,
			table.scoreType,
		),
	}),
);
```

### http/http-service.ts — class `Leaderboard`
Object-param RPC methods (keeps best per `(namespace, personId, scoreType)`,
direction configurable via `higherIsBetter`, default `true`):

- `recordScore(input: { namespace: string; personId: string; scoreType: string; score: number; personName?: string; higherIsBetter?: boolean; onlyIfAbsent?: boolean }): Promise<LeaderboardEntry>`
  — when `onlyIfAbsent` is true and an entry already exists for
  `(namespace, personId, scoreType)`, leave it untouched and return it as-is
  (used for "first attempt counts" daily boards). Otherwise upsert keeping best.
- `getLeaderboard(input: { namespace: string; scoreType: string; limit?: number; higherIsBetter?: boolean }): Promise<LeaderboardEntry[]>`
- `getPlayerRank(input: { namespace: string; personId: string; scoreType: string; higherIsBetter?: boolean }): Promise<LeaderboardEntry | null>`
- `fetch` returns `ok` on `/health`, else 404.

`LeaderboardEntry = { personId; personName: string | null; rank: number; score: number; achievedAt: Date }`.
`import type { Env } from "./main.js";` (generated).

Migrations: generate with `bunx drizzle-kit generate` after codegen; commit
`data-model/migrations/*`.

---

## Generic platform service: achievements

Location: `projects/rawkode.academy/platform/achievements/`
Worker name: `platform-achievements-rpc`. Entrypoint class: `Achievements`.
Website binding: `ACHIEVEMENTS`. D1 database id:
`83625427-47af-40ea-907e-d6682a93036a`.

The service is a **pure per-namespace unlock store** — no game-specific
definitions or criteria live here (those live in the game).

### service.cue
Same shape as leaderboard: `serviceName: "achievements"`, `servicePrefix:
"platform"`, `includeReadModel: false`, `includeHttp: true`, D1 `DB` binding with
the achievements database id above.

### env.cue
Mirror; `name: "rawkode-academy-platform-achievements"`.

### data-model/schema.ts
```ts
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const playerAchievementsTable = sqliteTable(
	"player_achievements",
	{
		namespace: text("namespace").notNull(),
		personId: text("person_id").notNull(),
		achievementId: text("achievement_id").notNull(),
		unlockedAt: integer("unlocked_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.namespace, table.personId, table.achievementId],
		}),
	}),
);
```

### http/http-service.ts — class `Achievements`
- `unlockAchievements(input: { namespace: string; personId: string; achievementIds: string[] }): Promise<{ unlocked: string[] }>` — idempotent bulk insert (`onConflictDoNothing`); returns the ids that were newly unlocked this call.
- `getPlayerAchievements(input: { namespace: string; personId: string }): Promise<{ achievementId: string; unlockedAt: string }[]>`
- `fetch` `/health` → `ok`, else 404.

---

## Website

### Page — `src/pages/games/guess-the-logo/index.astro`
- `PageWrapper` (title "Guess the Logo", description).
- `import { DISABLE_GAME_AUTH } from "astro:env/server"`.
- Build `logos: Logo[]` from `getCollection("technologies")`, keeping entries
  whose `resolveTechnologyIconUrl(entry.id, entry.data.logos)` is defined; map to
  `{ name: entry.data.name, iconUrl, cncfStatus: entry.data.cncf?.status ?? null }`.
- `const user = Astro.locals.user; const disableAuth = DISABLE_GAME_AUTH === "true";`
- If `!user && !disableAuth`: render a sign-in CTA (link to
  `/api/auth/sign-in?returnTo=/games/guess-the-logo`).
- Else: compute `const date = utcDateString(new Date())` and
  `const rounds = buildDailyRounds(logos, date)` **server-side**, then render
  `<div id="gtl-root" data-disable-auth data-player-name data-date={date}>` plus
  `<script type="application/json" id="gtl-rounds">{JSON.stringify(rounds)}</script>`,
  and a module script that parses the JSON and mounts
  `createApp(GuessTheLogo, { rounds, date, playerName, disableAuth })`.

### Pure logic — `src/lib/games/guess-the-logo.ts` (unit-tested, framework-free)
- Constants `ROUND_COUNT = 10`, `OPTION_COUNT = 4`, `TIMER_SECONDS = 15`.
- Types `Logo`, `Round = { logo: Logo; options: string[]; answer: string }`.
- A small **seeded PRNG** (e.g. a mulberry32-style `createRng(seed: number): () => number`)
  and `seedFromDate(date: string): number` (a stable string hash of `YYYY-MM-DD`).
  Do not use the global random function anywhere in game generation.
- `utcDateString(d: Date): string` — formats a Date to `YYYY-MM-DD` in UTC.
- `buildRounds(pool: Logo[], count, optionCount, rng): Round[]`
  — pick `count` distinct logos; for each, `options` = answer + `optionCount-1`
  distinct distractor **names** (≠ answer), shuffled — all draws via `rng`.
- `buildDailyRounds(pool: Logo[], date: string, count = ROUND_COUNT, optionCount = OPTION_COUNT): Round[]`
  — sort `pool` by `iconUrl`/name (a stable key) for reproducibility, then call
  `buildRounds` with `createRng(seedFromDate(date))`. Same `date` ⇒ identical
  rounds.
- `pickDistractors(answer, pool, n, rng): string[]`.
- `scoreGame(answers: (string | null)[], rounds: Round[]): number` — count where
  `answers[i] === rounds[i].answer` (null = timeout = wrong).

### Achievements definitions + evaluation — `src/lib/games/guess-the-logo-achievements.ts`
- `NAMESPACE = "guess-the-logo"`.
- `ACHIEVEMENTS: { id; name; description; icon }[]`:
  - `perfect-run` "Perfect Run" 💯 — 10/10 correct.
  - `halfway-there` "Halfway There" 🪜 — ≥5 correct.
  - `sandbox-surfer` "Sandbox Surfer" 🏄 — ≥1 sandbox logo in the run and **all**
    sandbox logos answered correctly.
  - `incubating-insider` "Incubating Insider" 🥚 — same rule for incubating.
  - `graduated-genius` "Graduated Genius" 🎓 — same rule for graduated.
  - `non-cncf-hero` "Non-CNCF Hero" 🦸 — ≥1 non-CNCF logo (`cncfStatus == null`)
    in the run and all of them answered correctly.
- `evaluateAchievements(rounds: Round[], answers: (string | null)[]): string[]` —
  pure; returns earned ids. Category rule: among rounds whose logo has that
  status, there is ≥1 and every one was answered correctly. Unit-tested.

### Client API — `src/lib/games/guess-the-logo-api.ts`
The server derives "today" itself, so the client sends no date.
- `getStatus(): Promise<{ alreadyPlayed: boolean; rank: number | null; score: number | null }>` → GET `/api/games/guess-the-logo/status` (today, for the current user).
- `submitScore(score: number): Promise<{ alreadyPlayed: boolean; rank: number; score: number }>` → POST `/api/games/guess-the-logo/score`.
- `getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>` → GET `/api/games/guess-the-logo/leaderboard` (today's board).
- `unlockAchievements(ids: string[]): Promise<{ unlocked: string[] }>` → POST `/api/games/guess-the-logo/achievements`.
- `getAchievements(): Promise<{ achievementId: string; unlockedAt: string }[]>` → GET `/api/games/guess-the-logo/achievements`.
- Throws on non-2xx with status code (mirror the SKI `game-api.ts` error style).

### Components — `src/components/games/guess-the-logo/`
- `GuessTheLogo.vue` — orchestrator. Props `{ rounds: Round[]; date: string; playerName: string | null; disableAuth: boolean }`. States `loading | intro | playing | results`. On mount: if `!disableAuth`, call `getStatus()`; if `alreadyPlayed`, fetch `getLeaderboard()` + `getAchievements()` and go straight to `ResultsView` (already-played view). Otherwise show `intro` (with the date, e.g. "Daily Challenge — June 13"). Per round: 15s countdown; selecting an option or timeout records the answer (null on timeout), sets `revealed`, brief pause (~900ms), advances. After 10: compute score via `scoreGame` + earned ids via `evaluateAchievements`; if `!disableAuth`, `submitScore` + `unlockAchievements` then `getLeaderboard`; show `ResultsView`. Do not rebuild rounds client-side — play the server-provided `rounds`.
- `LogoScanline.vue` — props `{ iconUrl: string; revealed: boolean }`. Ported scan-line CSS; `.revealed` toggles reveal. Scoped or component-global styles.
- `RoundView.vue` — props round, index, total, timer; renders `LogoScanline`, 4 option buttons (disabled after answer; correct/incorrect styling on reveal), and a countdown bar. Emits `answer(name | null)`.
- `ResultsView.vue` — props `{ score; total; earnedIds; newlyUnlocked; achievements; leaderboard; rank; alreadyPlayed }`. Shows the daily score, the achievement grid (earned highlighted; `newlyUnlocked` badged "NEW"), and today's leaderboard. Instead of "play again", show a **"Come back tomorrow"** message (this is a once-per-day game) and a share button that copies a Wordle-style result (e.g. `Guess the Logo <date> 8/10`) to the clipboard.
- UnoCSS utility classes consistent with the site; brand cyan `#00ceff` / purple `#5f5ed7`.

### API routes — `src/pages/api/games/guess-the-logo/`
All read `locals.user`; return 401 when absent. `import { env } from "cloudflare:workers"`.
Each route derives the day itself: `const scoreType = "daily-" + utcDateString(new Date())` (UTC). `NAMESPACE = "guess-the-logo"`.
- `status.ts` GET — `const existing = await env.LEADERBOARD.getPlayerRank({ namespace, personId: user.id, scoreType })`; return `{ alreadyPlayed: !!existing, rank: existing?.rank ?? null, score: existing?.score ?? null }`.
- `score.ts` POST — validate integer `0..10`; check `getPlayerRank` first — if an entry exists return `{ alreadyPlayed: true, rank, score }` (do not overwrite). Otherwise `env.LEADERBOARD.recordScore({ namespace, personId: user.id, scoreType, score, personName: user.name, onlyIfAbsent: true })`; return `{ alreadyPlayed: false, rank, score }`.
- `leaderboard.ts` GET — `env.LEADERBOARD.getLeaderboard({ namespace, scoreType, limit })` (today's board); serialize `achievedAt` to ISO.
- `achievements.ts` — POST: validate `achievementIds: string[]`; `env.ACHIEVEMENTS.unlockAchievements({ namespace, personId: user.id, achievementIds })`. GET: `env.ACHIEVEMENTS.getPlayerAchievements({ namespace, personId: user.id })`. (Achievements persist across days, so they use the bare namespace, not the dated scoreType.)

### Bindings
- `website/wrangler.jsonc` services: add
  `{ "binding": "LEADERBOARD", "service": "platform-leaderboard-rpc" }` and
  `{ "binding": "ACHIEVEMENTS", "service": "platform-achievements-rpc" }`.
- `website/worker-configuration.d.ts`: add
  `LEADERBOARD: Service<typeof import("../platform/leaderboard/http/http-service").Leaderboard>;`
  and
  `ACHIEVEMENTS: Service<typeof import("../platform/achievements/http/http-service").Achievements>;`

## Docs
- Root `CLAUDE.md`: document that after adding/changing a cuenv-managed service
  you must run `cuenv sync -A` at the repo root to materialize generated files
  (`wrangler.jsonc`, `package.json`, `main.ts`) so the Bun workspace and
  typechecks resolve.
- `projects/rawkode.academy/platform/CLAUDE.md`: note the generic `leaderboard`
  and `achievements` services (namespace-keyed, reusable; definitions/criteria
  live in the consuming app).

## Verification
1. `cuenv sync -A` at repo root, then `bun install`.
2. `bunx drizzle-kit generate` in each new service (commit migrations).
3. `bun run test` (Vitest) in the website — covers `buildRounds`,
   `pickDistractors`, `scoreGame`, `evaluateAchievements`.
4. `bunx astro check` in the website (types resolve incl. the two bindings).

## Human action required (deploy ordering)
The website preview deploy validates service bindings, so both new workers must
be deployed **before** the website CI binds them. Needs `CLOUDFLARE_API_TOKEN`:
1. `cd projects/rawkode.academy/platform/leaderboard && bunx wrangler d1 migrations apply DB --remote --config ./http/wrangler.jsonc && bunx wrangler deploy --config ./http/wrangler.jsonc`
2. Same for `platform/achievements`.
3. Confirm the D1 database **names** match the provided ids.

## Out of scope (v1)
Per-category difficulty (distractors are fully random), share cards, daily
challenge, sound.
