<script setup lang="ts">
import type { GameDefinition } from "@/lib/game-catalogue";
import { arcadeCard, gameTheme } from "@/styles/arcade";
defineProps<{ game: GameDefinition; featured?: boolean }>();
</script>

<template>
	<a :class="[arcadeCard({ tone: featured ? 'live' : 'default' }), gameTheme({ game: game.id }), 'game-card', `theme-${game.accent}`, { featured }]" :href="`/games/${game.id}`">
		<div class="card-topline"><span>{{ game.kicker }}</span><span class="player-count">{{ game.players }}</span></div>
		<div class="glyph" aria-hidden="true">
			<span v-if="game.mode === 'survey'">{ }</span><span v-else-if="game.mode === 'puzzle'">⌁</span><span v-else-if="game.mode === 'ladder'">↑</span><span v-else-if="game.mode === 'chase'">≫</span><span v-else-if="game.mode === 'list'">10</span><span v-else>∅</span>
		</div>
		<h2>{{ game.title }}</h2>
		<p>{{ game.description }}</p>
		<div class="card-footer"><span>{{ game.mechanic }}</span><b>Play <span aria-hidden="true">→</span></b></div>
	</a>
</template>

<style scoped>
.game-card { background: linear-gradient(135deg, rgb(24 38 74 / 95%), rgb(16 26 53 / 95%)); border: 1px solid var(--line); border-radius: 20px; display: flex; flex-direction: column; min-height: 295px; overflow: hidden; padding: 1.25rem; position: relative; transition: border-color .18s ease, transform .18s ease, background .18s ease; }
.game-card::after { background: radial-gradient(circle at 100% 0%, var(--card-glow), transparent 58%); content: ""; inset: 0; opacity: .22; pointer-events: none; position: absolute; }
.game-card:hover { border-color: var(--card-accent); transform: translateY(-3px); }
.card-topline, .card-footer { align-items: center; color: var(--mist); display: flex; font-family: "IBM Plex Mono", monospace; font-size: .66rem; justify-content: space-between; letter-spacing: .08em; position: relative; text-transform: uppercase; z-index: 1; }
.player-count { border: 1px solid var(--line); border-radius: 999px; padding: .22rem .45rem; }
.glyph { align-items: center; border: 1px solid color-mix(in srgb, var(--card-accent), transparent 48%); border-radius: 14px; color: var(--card-accent); display: flex; font-family: "IBM Plex Mono", monospace; font-size: 2.35rem; font-weight: 600; height: 72px; justify-content: center; margin: 1.8rem 0 1rem; position: relative; width: 72px; z-index: 1; }
h2 { font-family: "Space Grotesk", sans-serif; font-size: clamp(1.35rem, 2vw, 1.75rem); letter-spacing: -.05em; line-height: 1; margin: 0; position: relative; z-index: 1; }
p { color: var(--mist); font-size: .88rem; line-height: 1.55; margin: .8rem 0 1.4rem; max-width: 32ch; position: relative; z-index: 1; }
.card-footer { border-top: 1px solid var(--line); margin-top: auto; padding-top: .85rem; }
.card-footer b { color: var(--cloud); font-family: Inter, sans-serif; font-size: .76rem; letter-spacing: 0; text-transform: none; }.card-footer b span { color: var(--card-accent); font-size: 1.1rem; }
.theme-cyan { --card-accent: var(--cyan); --card-glow: var(--cyan); }.theme-violet { --card-accent: var(--violet); --card-glow: var(--violet); }.theme-lime { --card-accent: var(--lime); --card-glow: var(--lime); }.theme-amber { --card-accent: var(--amber); --card-glow: var(--amber); }.theme-coral { --card-accent: var(--coral); --card-glow: var(--coral); }.theme-pink { --card-accent: #ff83d3; --card-glow: #ff83d3; }
.featured { min-height: 325px; }
</style>
