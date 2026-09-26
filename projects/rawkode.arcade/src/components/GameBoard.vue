<script setup lang="ts">
import { computed } from "vue";
import GameMark from "@/components/GameMark.vue";
import { gameById, type GameId } from "@/lib/game-catalogue";
import type { PublicRoomState } from "@/lib/live-contract";
import {
	gameBoardText,
	gameBoardTrack,
	gameBoardTrackFill,
	gameFrame,
} from "@/styles/game-brand";

const props = withDefaults(
	defineProps<{
		game: GameId;
		room: PublicRoomState;
		scale?: "live" | "cast";
	}>(),
	{ scale: "live" },
);

const definition = computed(() => gameById(props.game));
const slots = computed(() =>
	gameFrame({ motif: definition.value.brand.motif, scale: props.scale }),
);
const board = computed(() => props.room.gameBoard);
const diffEntries = computed(() => board.value?.mergeConflict?.entries ?? []);
const spinlock = computed(() => board.value?.spinlock ?? props.room.spinlock);
const principalLadder = computed(() => board.value?.principalEngineer);
const ladderRungs = computed(() =>
	Array.from({ length: principalLadder.value?.total ?? 0 }, (_, index) => index),
);
const race = computed(() => board.value?.raceCondition);
const raceProgress = computed(() =>
	race.value ? Math.min(100, Math.round((race.value.playerPosition / Math.max(race.value.total, 1)) * 100)) : 0,
);
const chaserProgress = computed(() =>
	race.value ? Math.min(100, Math.round((race.value.chaserPosition / Math.max(race.value.total, 1)) * 100)) : 0,
);
const nines = computed(() => board.value?.tenNines);
const relayCells = computed(() =>
	Array.from({ length: nines.value?.total ?? 0 }, (_, index) => index),
);
const rarityBins = computed(() => board.value?.nullPointer?.distribution ?? []);
const largestRarityBin = computed(() =>
	Math.max(1, ...rarityBins.value.map((entry) => entry.count)),
);
const diffPrefix = ["<<<<<<<", "=======", ">>>>>>>"] as const;
</script>

<template>
	<section :class="slots.root" :aria-label="definition.brand.boardLabel" data-game-board>
		<div :class="slots.meta">
			<GameMark :game="game" :scale="scale === 'cast' ? 'cast' : 'compact'" />
			<span>{{ definition.brand.code }} · {{ definition.brand.boardLabel }}</span>
		</div>

		<div v-if="definition.brand.motif === 'diff'" :class="slots.board" data-testid="merge-board">
			<div v-for="(entry, index) in diffEntries" :key="entry.rank" :class="slots.cell">
				<span :class="slots.signal">{{ diffPrefix[index % diffPrefix.length] }}</span>
				<span :class="gameBoardText">{{ entry.revealed ? entry.label ?? `Rank ${entry.rank}` : "▢" }}</span>
			</div>
			<span v-if="!diffEntries.length" :class="slots.signal">Awaiting revealed survey ranks</span>
		</div>

		<div v-else-if="definition.brand.motif === 'wheel'" :class="slots.board" data-testid="spin-board">
			<GameMark game="spinlock" :scale="scale === 'cast' ? 'cast' : 'base'" />
			<output :class="slots.cell" aria-label="Current phrase board">
				{{ spinlock?.board ?? "▢ ▢ ▢ ▢" }}
			</output>
			<span :class="slots.signal" data-testid="spin-value">
				Wheel {{ spinlock?.activeValue ?? 0 }}
				<template v-if="typeof spinlock?.turn === 'number'">· Turn {{ spinlock.turn + 1 }}</template>
			</span>
			<span v-if="spinlock?.letters.length" :class="slots.meta" aria-label="Guessed letters">
				<b v-for="letter in spinlock.letters" :key="letter" :data-testid="`spin-letter-${letter}`">{{ letter }}</b>
			</span>
			<span v-else :class="slots.meta">No letters revealed</span>
		</div>

		<div v-else-if="definition.brand.motif === 'ladder'" :class="slots.board" data-testid="principal-board">
			<span
				v-for="rung in ladderRungs"
				:key="rung"
				:class="[slots.cell, rung === principalLadder?.index ? slots.marker : undefined]"
				:aria-current="rung === principalLadder?.index ? 'step' : undefined"
			>
				{{ String(rung + 1).padStart(2, "0") }}
			</span>
			<span v-if="!ladderRungs.length" :class="slots.signal">Awaiting the live ladder</span>
		</div>

		<div v-else-if="definition.brand.motif === 'race'" :class="slots.board" data-testid="race-board">
			<div v-if="race" :class="slots.track">
				<span :class="slots.signal">PLAYER</span>
				<div :class="gameBoardTrack" aria-label="Player progress">
					<i :class="gameBoardTrackFill" :style="{ inlineSize: `${raceProgress}%` }" />
				</div>
				<span :class="slots.marker">{{ raceProgress }}%</span>
			</div>
			<div v-if="race" :class="slots.track">
				<span :class="slots.signal">CHASER</span>
				<div :class="gameBoardTrack" aria-label="Chaser progress">
					<i :class="gameBoardTrackFill" :style="{ inlineSize: `${chaserProgress}%` }" />
				</div>
				<span :class="slots.marker">{{ chaserProgress }}%</span>
			</div>
			<span v-if="!race" :class="slots.signal">Awaiting authoritative chase positions</span>
		</div>

		<div v-else-if="definition.brand.motif === 'matrix'" :class="slots.board" data-testid="ten-nines-board">
			<span
				v-for="cell in relayCells"
				:key="cell"
				:class="[slots.cell, cell < (nines?.found.length ?? 0) ? slots.marker : undefined]"
			>
				{{ cell < (nines?.found.length ?? 0) ? "●" : String(cell + 1).padStart(2, "0") }}
			</span>
			<span :class="slots.signal" v-if="nines">{{ nines.found.length }} of {{ nines.total }} accepted relay entries</span>
			<span :class="slots.signal" v-else>Awaiting accepted relay entries</span>
		</div>

		<div v-else :class="slots.board" data-testid="null-pointer-board">
			<div v-for="entry in rarityBins" :key="entry.label" :class="slots.cell">
				<div :class="gameBoardTrack" :aria-label="`${entry.label}: ${entry.count} responses`">
					<i
						:class="gameBoardTrackFill"
						:style="{ inlineSize: `${Math.round((entry.count / largestRarityBin) * 100)}%` }"
					/>
				</div>
				<span :class="slots.signal">{{ entry.count }}</span>
			</div>
			<span v-if="!rarityBins.length" :class="slots.signal">The field is waiting for responses</span>
		</div>
	</section>
</template>
