<script setup lang="ts">
import { computed, useId } from "vue";
import { academyBracket } from "@rawkodeacademy/design-system";
import type { Bracket, BracketMatch, BracketSide } from "./queries";

const props = defineProps<{ brackets: readonly Bracket[] }>();
const s = academyBracket();
const boardId = useId();

// Group into new arrays so sorting never mutates service data or caller fixtures.
function roundsOf(matches: readonly BracketMatch[]): [number, BracketMatch[]][] {
	const rounds = new Map<number, BracketMatch[]>();
	for (const match of matches) {
		const round = rounds.get(match.roundNumber) ?? [];
		round.push(match);
		rounds.set(match.roundNumber, round);
	}
	return [...rounds.entries()].sort(([a], [b]) => a - b).map(([number, matches]) => [number, matches.sort((a, b) => a.positionInRound - b.positionInRound)]);
}

const boards = computed(() => props.brackets.map(bracket => ({ bracket, rounds: roundsOf(bracket.matches), start: startDate(bracket.startsAt) })));
const sideLabel = (side: BracketSide | null | undefined) => side?.displayName?.trim() || "TBD";
const isWinner = (side: BracketSide | null | undefined, match: BracketMatch) => Boolean(side?.id && match.winner?.id === side.id);
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
	weekday: "short", day: "numeric", month: "short", year: "numeric",
	hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
});
function startDate(iso: string): { iso: string; label: string } | null {
	const date = new Date(iso);
	return Number.isFinite(date.getTime()) ? { iso: date.toISOString(), label: dateFormatter.format(date) } : null;
}
</script>

<template>
	<div :class="s.root">
		<p v-if="boards.length === 0" :class="s.empty">No brackets are available yet.</p>
		<section v-for="({ bracket, rounds, start }, index) in boards" :key="bracket.id"
			:class="s.bracket" :aria-labelledby="`${boardId}-${index}-title`">
			<header :class="s.header">
				<h2 :id="`${boardId}-${index}-title`" :class="s.title">{{ bracket.name }}</h2>
				<div :class="s.metadata">
					<span>{{ bracket.kind }} · {{ bracket.status }}</span>
					<span v-if="start">
						Starts <time :datetime="start.iso">{{ start.label }}</time>
					</span>
					<span v-else>Start date to be announced</span>
				</div>
			</header>
			<template v-if="rounds.length">
				<p :id="`${boardId}-${index}-hint`" :class="s.hint">Scroll horizontally to view all rounds. Keyboard users can focus the board and use the arrow keys.</p>
				<div :class="s.board" role="region" tabindex="0"
					:aria-label="`${bracket.name} rounds`" :aria-describedby="`${boardId}-${index}-hint`">
					<section v-for="[round, matches] in rounds" :key="round" :class="s.round"
						:aria-labelledby="`${boardId}-${index}-round-${round}`">
						<h3 :id="`${boardId}-${index}-round-${round}`" :class="s.roundTitle">Round {{ round }}</h3>
						<ol :class="s.matches">
							<li v-for="match in matches" :key="match.id" :class="s.match" :aria-label="`Match ${match.positionInRound}`">
								<div :class="s.side" :data-winner="isWinner(match.sideA, match)">
									<span :class="s.name">{{ sideLabel(match.sideA) }}</span>
									<span v-if="match.sideA?.seed != null" :class="s.seed" :aria-label="`Seed ${match.sideA.seed}`">#{{ match.sideA.seed }}</span>
								</div>
								<span :class="s.versus">vs</span>
								<div :class="s.side" :data-winner="isWinner(match.sideB, match)">
									<span :class="s.name">{{ sideLabel(match.sideB) }}</span>
									<span v-if="match.sideB?.seed != null" :class="s.seed" :aria-label="`Seed ${match.sideB.seed}`">#{{ match.sideB.seed }}</span>
								</div>
								<p v-if="match.status" :class="s.status" :data-live="match.status === 'live'">{{ match.status === "live" ? "Live" : match.status }}</p>
								<p v-if="match.winner" :class="s.winner">Winner: {{ sideLabel(match.winner) }}</p>
							</li>
						</ol>
					</section>
				</div>
			</template>
			<p v-else :class="s.empty">No matches have been announced for this bracket.</p>
		</section>
	</div>
</template>
