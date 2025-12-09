<template>
	<div class="menu-screen">
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
		linear-gradient(rgb(var(--brand-primary) / 0.1) 1px, transparent 1px),
		linear-gradient(90deg, rgb(var(--brand-primary) / 0.1) 1px, transparent 1px);
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
	color: rgb(var(--brand-primary));
	text-shadow:
		0 0 20px rgb(var(--brand-primary) / 0.5),
		0 0 40px rgb(var(--brand-primary) / 0.3);
	letter-spacing: 0.1em;
}

.title-sub {
	display: block;
	font-size: 2.5rem;
	font-weight: 300;
	color: rgb(var(--brand-secondary));
	letter-spacing: 0.3em;
	margin-top: 0.5rem;
}

.tagline {
	color: rgb(107 114 128);
	font-size: 1.1rem;
	margin-bottom: 3rem;
}

:root.dark .tagline {
	color: rgb(156 163 175);
}

.start-btn {
	background: transparent;
	border: 2px solid rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
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
	background: rgb(var(--brand-primary));
	transform: translateX(-100%);
	transition: transform 0.3s ease;
	z-index: -1;
}

.start-btn:hover {
	color: white;
}

:root.dark .start-btn:hover {
	color: rgb(17 24 39);
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
	border: 1px solid rgb(var(--brand-primary) / 0.5);
	color: rgb(var(--brand-primary) / 0.8);
	padding: 0.75rem 1.5rem;
	font-family: inherit;
	font-size: 0.9rem;
	cursor: pointer;
	transition: all 0.3s ease;
}

.nav-btn:hover {
	border-color: rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
	background: rgb(var(--brand-primary) / 0.1);
}

.instructions {
	margin-top: 3rem;
	color: rgb(107 114 128);
	font-size: 0.9rem;
	line-height: 1.8;
}

:root.dark .instructions {
	color: rgb(107 114 128);
}
</style>
