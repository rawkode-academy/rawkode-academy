<template>
	<div :class="gameTheme.root" class="menu-screen">
		<div class="grid-bg"></div>

		<div class="content">
			<h1 class="title">
				<span class="title-main">SECRET OF</span>
				<span class="title-sub">KUBERNETES ISLAND</span>
			</h1>

			<p class="tagline">Breach the cluster. One insult at a time.</p>

			<button class="start-btn" @click="$emit('start')">
				<span class="btn-text">[ START GAME ]</span>
			</button>

			<div class="menu-nav">
				<button class="nav-btn" @click="$emit('viewAchievements')">
					[ ACHIEVEMENTS ]
				</button>
				<button class="nav-btn" @click="$emit('viewLeaderboard')">
					[ LEADERBOARD ]
				</button>
			</div>

			<div class="instructions">
				<p>Navigate the cluster layers</p>
				<p>Challenge security services</p>
				<p>Use your wit to breach defenses</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academyGame } from "@rawkodeacademy/design-system";
const gameTheme = academyGame();
defineEmits<{
	start: [];
	viewAchievements: [];
	viewLeaderboard: [];
}>();
</script>

<style scoped>
.menu-screen {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
	padding: 2rem;
}

.grid-bg {
	position: absolute;
	inset: 0;
	background-image:
		linear-gradient(color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px),
		linear-gradient(90deg, color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px);
	background-size: 40px 40px;
	animation: grid-move 20s linear infinite;
}

@keyframes grid-move {
	0% {
		transform: translate(0, 0);
	}
	100% {
		transform: translate(40px, 40px);
	}
}

.content {
	text-align: center;
	z-index: 1;
}

.title {
	margin-bottom: 1rem;
}

.title-main {
	display: block;
	font-size: 4rem;
	font-weight: 700;
	color: var(--colors-academy-accent);
	text-shadow:
		0 0 20px color-mix(in srgb, var(--colors-academy-accent) 50.0%, transparent),
		0 0 40px color-mix(in srgb, var(--colors-academy-accent) 30.0%, transparent);
	letter-spacing: 0.1em;
}

.title-sub {
	display: block;
	font-size: 2.5rem;
	font-weight: 300;
	color: var(--colors-academy-status-violet);
	letter-spacing: 0.3em;
	margin-top: 0.5rem;
}

.tagline {
	color: var(--colors-academy-text-muted);
	font-size: 1.1rem;
	margin-bottom: 3rem;
}

:root.dark .tagline {
	color: var(--colors-academy-text-muted);
}

.start-btn {
	background: transparent;
	border: 2px solid var(--colors-academy-accent);
	color: var(--colors-academy-accent);
	padding: 1rem 2.5rem;
	font-family: inherit;
	font-size: 1.2rem;
	cursor: pointer;
	transition: all 0.3s ease;
	position: relative;
	overflow: hidden;
}

.start-btn::before {
	content: "";
	position: absolute;
	inset: 0;
	background: var(--colors-academy-accent);
	transform: translateX(-100%);
	transition: transform 0.3s ease;
	z-index: -1;
}

.start-btn:hover {
	color: white;
}

:root.dark .start-btn:hover {
	color: var(--colors-academy-text);
}

.start-btn:hover::before {
	transform: translateX(0);
}

.btn-text {
	animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}

.menu-nav {
	display: flex;
	justify-content: center;
	gap: 1rem;
	margin-top: 1.5rem;
}

.nav-btn {
	background: transparent;
	border: 1px solid color-mix(in srgb, var(--colors-academy-accent) 50.0%, transparent);
	color: color-mix(in srgb, var(--colors-academy-accent) 80.0%, transparent);
	padding: 0.75rem 1.5rem;
	font-family: inherit;
	font-size: 0.9rem;
	cursor: pointer;
	transition: all 0.3s ease;
}

.nav-btn:hover {
	border-color: var(--colors-academy-accent);
	color: var(--colors-academy-accent);
	background: color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent);
}

.instructions {
	margin-top: 3rem;
	color: var(--colors-academy-text-muted);
	font-size: 0.9rem;
	line-height: 1.8;
}

:root.dark .instructions {
	color: var(--colors-academy-text-muted);
}

@media (max-width: 768px) {
	.menu-screen {
		padding: 1.5rem 1rem;
		min-height: calc(100vh - 140px);
	}

	.title-main {
		font-size: 2.5rem;
		letter-spacing: 0.08em;
	}

	.title-sub {
		font-size: 1.5rem;
		letter-spacing: 0.15em;
	}

	.tagline {
		font-size: 1rem;
		margin-bottom: 2rem;
	}

	.start-btn,
	.nav-btn {
		width: 100%;
		max-width: 320px;
	}

	.menu-nav {
		flex-direction: column;
		align-items: center;
	}

	.instructions {
		margin-top: 2rem;
		font-size: 0.85rem;
	}
}
</style>
