<script setup lang="ts">
import type { GameId } from "@/lib/game-catalogue";
import { gameById } from "@/lib/game-catalogue";
import { gameMark } from "@/styles/game-brand";

const props = withDefaults(
	defineProps<{ game: GameId; scale?: "compact" | "base" | "cast" }>(),
	{ scale: "base" },
);
const definition = gameById(props.game);
</script>

<template>
	<span :class="gameMark({ motif: definition.brand.motif, scale })" aria-hidden="true">
		<svg v-if="definition.brand.motif === 'diff'" viewBox="0 0 64 64" fill="none" focusable="false">
			<path d="M9 14h18M9 32h46M37 50h18M18 6 9 14l9 8M46 42l9 8-9 8" stroke="currentColor" stroke-width="5" stroke-linecap="square" />
		</svg>
		<svg v-else-if="definition.brand.motif === 'wheel'" viewBox="0 0 64 64" fill="none" focusable="false">
			<circle cx="32" cy="32" r="23" stroke="currentColor" stroke-width="5" />
			<circle cx="32" cy="32" r="5" fill="currentColor" />
			<path d="m32 9 8 23-8 23-8-23 8-23ZM9 32h46" stroke="currentColor" stroke-width="4" />
		</svg>
		<svg v-else-if="definition.brand.motif === 'ladder'" viewBox="0 0 64 64" fill="none" focusable="false">
			<path d="M17 55 27 9M37 55 47 9M22 43h20M25 30h20M28 17h20" stroke="currentColor" stroke-width="5" stroke-linecap="square" />
		</svg>
		<svg v-else-if="definition.brand.motif === 'race'" viewBox="0 0 64 64" fill="none" focusable="false">
			<path d="M8 21h48M8 43h48" stroke="currentColor" stroke-width="5" stroke-dasharray="10 6" />
			<path d="m40 10 14 11-14 11M22 32 8 43l14 11" stroke="currentColor" stroke-width="5" stroke-linejoin="bevel" />
		</svg>
		<svg v-else-if="definition.brand.motif === 'matrix'" viewBox="0 0 64 64" fill="none" focusable="false">
			<path d="M10 10h44v44H10zM10 32h44M32 10v44M21 10v44M43 10v44" stroke="currentColor" stroke-width="4" />
		</svg>
		<svg v-else viewBox="0 0 64 64" fill="none" focusable="false">
			<circle cx="18" cy="18" r="7" stroke="currentColor" stroke-width="4" />
			<circle cx="46" cy="24" r="4" fill="currentColor" />
			<circle cx="29" cy="46" r="8" stroke="currentColor" stroke-width="4" stroke-dasharray="5 4" />
		</svg>
	</span>
</template>
