<script setup lang="ts">
import { ref, onMounted } from "vue";
import { actions } from "astro:actions";
import type { LeaderboardEntry } from "@/lib/games/guess-the-logo-api";

interface AchievementDef {
	id: string;
	name: string;
	description: string;
	icon: string;
}

const props = defineProps<{
	score: number;        // computeScore points integer
	correct: number;      // scoreGame count 0..5
	total: number;
	perRoundCorrect: boolean[];
	earnedIds: string[];
	newlyUnlocked: string[];
	achievements: AchievementDef[];
	leaderboard: LeaderboardEntry[];
	rank: number | null;
	alreadyPlayed: boolean;
	weekLabel: string;    // e.g. "Week of Jun 9"
	date: string;         // YYYY-MM-DD (kept for leaderboard date display)
	isSignedIn: boolean;  // newsletter opt-in needs an authenticated learner
}>();

const copied = ref(false);

// Newsletter: notify the player when the weekly logos change. Uses the existing
// newsletter service (EMAIL_PREFERENCES) via the shared astro:action; one-click
// since the player is already signed in.
const newsletterState = ref<"idle" | "loading" | "done" | "error">("idle");

async function subscribeNewsletter(): Promise<void> {
	if (newsletterState.value === "loading" || newsletterState.value === "done") {
		return;
	}
	newsletterState.value = "loading";
	try {
		const { data, error } = await actions.newsletter.subscribe({
			audience: "cnicon",
			source: "website:cnicon:results",
		});
		if (error) throw new Error(error.message);
		newsletterState.value = data?.success ? "done" : "error";
	} catch {
		newsletterState.value = "error";
	}
}

// Reflect an existing subscription so we don't show "Notify me" to someone who
// already opted in. Best-effort; on failure the CTA stays available.
onMounted(async () => {
	if (!props.isSignedIn) return;
	try {
		const res = await fetch("/api/subscriptions/check?audienceId=cnicon");
		if (!res.ok) return;
		const data = (await res.json()) as { isSubscribed?: boolean };
		if (data.isSubscribed) {
			newsletterState.value = "done";
		}
	} catch {
		// non-fatal
	}
});

function buildShareText(): string {
	const tail =
		"Can you guess the logos? https://rawkode.academy/games/cnicon";
	// Per-round squares are only known for a freshly-played game. On a revisit
	// the leaderboard only stores points, so omit the squares (no breakdown).
	const hasBreakdown = props.perRoundCorrect.length === props.total;
	if (hasBreakdown) {
		const squares = Array.from({ length: props.total }, (_, i) =>
			props.perRoundCorrect[i] ? "🟩" : "⬛",
		).join("");
		return `CNIcon · ${props.weekLabel} · ${props.score} pts\n${squares} — ${tail}`;
	}
	return `CNIcon · ${props.weekLabel} · ${props.score} pts — ${tail}`;
}

// The correct-count breakdown is only meaningful for a freshly-played game; the
// stored leaderboard entry holds points only, so hide it on a revisit.
const hasBreakdown = props.perRoundCorrect.length === props.total;

async function handleShare() {
	const text = buildShareText();
	try {
		await navigator.clipboard.writeText(text);
		copied.value = true;
		setTimeout(() => {
			copied.value = false;
		}, 2000);
	} catch {
		// Fallback: prompt
		prompt("Copy this result:", text);
	}
}

function isEarned(id: string): boolean {
	return props.earnedIds.includes(id);
}

function isNew(id: string): boolean {
	return props.newlyUnlocked.includes(id);
}

function formatAchievedAt(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function rankSuffix(n: number): string {
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return "th";
	const last = n % 10;
	if (last === 1) return "st";
	if (last === 2) return "nd";
	if (last === 3) return "rd";
	return "th";
}
</script>

<template>
	<div class="gtl-results">
		<!-- Header -->
		<div class="gtl-results-header">
			<p class="gtl-results-week">{{ weekLabel }}</p>
			<h2 class="gtl-results-title">Weekly Challenge Complete</h2>
			<p v-if="alreadyPlayed" class="gtl-already-played-note">You already played this week.</p>
		</div>

		<!-- Score: points large, correct/total secondary -->
		<div class="gtl-score-block">
			<div class="gtl-score-points">{{ score.toLocaleString() }} <span class="gtl-score-pts-label">pts</span></div>
			<div v-if="hasBreakdown" class="gtl-score-fraction">
				<span class="gtl-score-num">{{ correct }}</span>
				<span class="gtl-score-sep">/</span>
				<span class="gtl-score-denom">{{ total }}</span>
				<span class="gtl-score-correct-label">correct</span>
			</div>
		</div>

		<p v-if="rank !== null" class="gtl-rank-line">
			You ranked <strong>{{ rank }}{{ rankSuffix(rank) }}</strong> this week.
		</p>

		<!-- Share button -->
		<button class="gtl-share-btn" @click="handleShare">
			{{ copied ? "Copied!" : "Share Result" }}
		</button>

		<!-- Come back next week -->
		<div class="gtl-comeback">
			<span class="gtl-comeback-icon">📅</span>
			<span>Come back next Monday for a new weekly challenge.</span>
		</div>

		<!-- Newsletter: notify when the weekly logos change -->
		<div v-if="isSignedIn" class="gtl-newsletter">
			<template v-if="newsletterState === 'done'">
				<span class="gtl-newsletter-icon">✅</span>
				<p class="gtl-newsletter-text">You're on the list — we'll email you each Monday when the logos change.</p>
			</template>
			<template v-else>
				<div class="gtl-newsletter-copy">
					<span class="gtl-newsletter-title">Never miss a week</span>
					<span class="gtl-newsletter-sub">Get an email each Monday when CNIcon's logos change.</span>
				</div>
				<div class="gtl-newsletter-action">
					<button
						class="gtl-newsletter-btn"
						:disabled="newsletterState === 'loading'"
						@click="subscribeNewsletter"
					>
						{{ newsletterState === "loading" ? "Subscribing…" : "Notify me" }}
					</button>
					<span v-if="newsletterState === 'error'" class="gtl-newsletter-error" role="alert">
						Couldn't subscribe right now. Try again in a moment.
					</span>
				</div>
			</template>
		</div>

		<!-- Achievements -->
		<section class="gtl-section" aria-label="Achievements">
			<h3 class="gtl-section-title">Achievements</h3>
			<div class="gtl-achievements-grid">
				<div
					v-for="a in achievements"
					:key="a.id"
					class="gtl-achievement-card"
					:class="{ 'gtl-achievement-card--earned': isEarned(a.id), 'gtl-achievement-card--locked': !isEarned(a.id) }"
				>
					<span class="gtl-achievement-icon">{{ isEarned(a.id) ? a.icon : '🔒' }}</span>
					<div class="gtl-achievement-info">
						<span class="gtl-achievement-name">{{ a.name }}</span>
						<span v-if="isNew(a.id)" class="gtl-achievement-new-badge">NEW</span>
						<p class="gtl-achievement-desc">{{ a.description }}</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Leaderboard -->
		<section v-if="leaderboard.length > 0" class="gtl-section" aria-label="This week's leaderboard">
			<h3 class="gtl-section-title">This Week's Leaderboard</h3>
			<ol class="gtl-leaderboard">
				<li
					v-for="entry in leaderboard"
					:key="entry.personId"
					class="gtl-leaderboard-entry"
					:class="{ 'gtl-leaderboard-entry--self': rank !== null && entry.rank === rank }"
				>
					<span class="gtl-lb-rank">{{ entry.rank }}</span>
					<span class="gtl-lb-name">{{ entry.personName ?? "Anonymous" }}</span>
					<span class="gtl-lb-score">{{ entry.score }} pts</span>
					<span class="gtl-lb-time">{{ formatAchievedAt(entry.achievedAt) }}</span>
				</li>
			</ol>
		</section>
	</div>
</template>

<style scoped>
.gtl-results {
	display: flex;
	flex-direction: column;
	gap: 2rem;
	width: 100%;
	max-width: 40rem;
	margin: 0 auto;
	padding: 1.5rem 1rem;
}

.gtl-results-header {
	text-align: center;
}

.gtl-results-week {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.75rem;
	font-weight: 600;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
	margin-bottom: 0.5rem;
}

.gtl-results-title {
	font-family: var(--font-instrument-serif, serif);
	font-style: italic;
	font-size: 2rem;
	font-weight: 400;
	color: var(--editorial-ink, oklch(0.18 0.02 60));
	margin: 0;
}

.gtl-already-played-note {
	margin-top: 0.5rem;
	font-size: 0.85rem;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
}

/* Score block */
.gtl-score-block {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25rem;
}

.gtl-score-points {
	font-family: var(--font-instrument-serif, serif);
	font-size: 4rem;
	font-weight: 400;
	color: #00ceff;
	line-height: 1;
}

.gtl-score-pts-label {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 1.25rem;
	font-weight: 600;
	letter-spacing: 0.1em;
	color: color-mix(in srgb, #00ceff 60%, transparent);
	vertical-align: baseline;
}

.gtl-score-fraction {
	display: flex;
	align-items: baseline;
	gap: 0.2rem;
}

.gtl-score-num {
	font-family: var(--font-instrument-serif, serif);
	font-size: 2rem;
	font-weight: 400;
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
}

.gtl-score-sep {
	font-size: 1.5rem;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
}

.gtl-score-denom {
	font-family: var(--font-instrument-serif, serif);
	font-size: 2rem;
	font-weight: 400;
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
}

.gtl-score-correct-label {
	margin-left: 0.4rem;
	align-self: center;
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.7rem;
	font-weight: 600;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
}

.gtl-rank-line {
	text-align: center;
	font-size: 0.95rem;
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
}

.gtl-share-btn {
	display: block;
	margin: 0 auto;
	padding: 0.75rem 2rem;
	border-radius: 0.5rem;
	border: 1px solid var(--editorial-hairline, oklch(0.18 0.02 60 / 0.12));
	background: linear-gradient(135deg, #5f5ed7, #00ceff);
	color: #fff;
	font-family: var(--font-inter-tight, system-ui, sans-serif);
	font-size: 0.95rem;
	font-weight: 600;
	cursor: pointer;
	transition: opacity 150ms ease, transform 150ms ease;
}

.gtl-share-btn:hover {
	opacity: 0.9;
	transform: translateY(-1px);
}

.gtl-comeback {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 0.875rem 1.25rem;
	border-radius: 0.5rem;
	border: 1px solid var(--editorial-hairline, oklch(0.18 0.02 60 / 0.12));
	background: var(--surface-card, oklch(0.97 0.008 85));
	font-size: 0.9rem;
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
	text-align: center;
}

.gtl-comeback-icon {
	font-size: 1.1rem;
}

.gtl-newsletter {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem 1.25rem;
	padding: 1rem 1.25rem;
	border-radius: 0.5rem;
	border: 1px solid color-mix(in srgb, #5f5ed7 35%, transparent);
	background: color-mix(in srgb, #5f5ed7 6%, var(--surface-card, oklch(0.97 0.008 85)));
}

.gtl-newsletter-copy {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
	min-width: 12rem;
	flex: 1;
}

.gtl-newsletter-title {
	font-size: 0.95rem;
	font-weight: 600;
	color: var(--editorial-ink, oklch(0.18 0.02 60));
}

.gtl-newsletter-sub {
	font-size: 0.825rem;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
}

.gtl-newsletter-action {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 0.35rem;
}

.gtl-newsletter-btn {
	padding: 0.5rem 1.25rem;
	border-radius: 0.5rem;
	border: none;
	background: linear-gradient(135deg, #5f5ed7, #00ceff);
	color: #fff;
	font-family: var(--font-inter-tight, system-ui, sans-serif);
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;
	transition: opacity 150ms ease;
}

.gtl-newsletter-btn:hover:not(:disabled) {
	opacity: 0.9;
}

.gtl-newsletter-btn:disabled {
	opacity: 0.6;
	cursor: default;
}

.gtl-newsletter-error {
	font-size: 0.75rem;
	color: #dc2626;
}

.gtl-newsletter-icon {
	font-size: 1.1rem;
}

.gtl-newsletter-text {
	margin: 0;
	font-size: 0.9rem;
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
}

.gtl-section {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.gtl-section-title {
	font-family: var(--font-inter-tight, system-ui, sans-serif);
	font-size: 0.75rem;
	font-weight: 600;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
	margin: 0;
}

.gtl-achievements-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	gap: 0.75rem;
}

.gtl-achievement-card {
	display: flex;
	gap: 0.75rem;
	padding: 0.875rem 1rem;
	border-radius: 0.5rem;
	border: 1px solid var(--editorial-hairline, oklch(0.18 0.02 60 / 0.12));
	background: var(--surface-card, oklch(0.97 0.008 85));
	align-items: flex-start;
}

.gtl-achievement-card--earned {
	border-color: color-mix(in srgb, #5f5ed7 40%, transparent);
	background: color-mix(in srgb, #5f5ed7 6%, var(--surface-card, oklch(0.97 0.008 85)));
}

.gtl-achievement-card--locked {
	opacity: 0.55;
}

.gtl-achievement-icon {
	font-size: 1.5rem;
	line-height: 1;
	flex-shrink: 0;
}

.gtl-achievement-info {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	min-width: 0;
}

.gtl-achievement-name {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--editorial-ink, oklch(0.18 0.02 60));
	line-height: 1.2;
}

.gtl-achievement-new-badge {
	display: inline-block;
	padding: 0.1rem 0.4rem;
	border-radius: 0.25rem;
	background: linear-gradient(135deg, #5f5ed7, #00ceff);
	color: #fff;
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.65rem;
	font-weight: 700;
	letter-spacing: 0.1em;
	align-self: flex-start;
}

.gtl-achievement-desc {
	font-size: 0.8rem;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
	line-height: 1.4;
	margin: 0;
}

.gtl-leaderboard {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 0;
	margin: 0;
	list-style: none;
}

.gtl-leaderboard-entry {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.625rem 0.875rem;
	border-radius: 0.375rem;
	border: 1px solid var(--editorial-hairline, oklch(0.18 0.02 60 / 0.12));
	background: var(--surface-card, oklch(0.97 0.008 85));
}

.gtl-leaderboard-entry--self {
	border-color: color-mix(in srgb, #00ceff 50%, transparent);
	background: color-mix(in srgb, #00ceff 8%, var(--surface-card, oklch(0.97 0.008 85)));
}

.gtl-lb-rank {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.75rem;
	font-weight: 700;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
	width: 1.5rem;
	text-align: right;
	flex-shrink: 0;
}

.gtl-lb-name {
	flex: 1;
	font-size: 0.9rem;
	font-weight: 500;
	color: var(--editorial-ink, oklch(0.18 0.02 60));
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.gtl-lb-score {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.875rem;
	font-weight: 700;
	color: #5f5ed7;
	flex-shrink: 0;
}

.gtl-lb-time {
	font-size: 0.75rem;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
	flex-shrink: 0;
}
</style>
