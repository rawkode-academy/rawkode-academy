<script setup lang="ts">
import { css, cx } from "../../../styled-system/css";

interface Props {
	title: string;
	description: string;
	segments: Segment[];
}

interface Segment {
	title: string;
	description: string;
	emoji?: string;
}

defineProps<Props>();
</script>

<template>
	<section :class="css({ position: 'relative', px: '4', py: '12', sm: { py: '20' } })">
		<div :class="css({ pointerEvents: 'none', position: 'absolute', inset: '0', display: 'flex', justifyContent: 'center' })">
			<div :class="css({
				h: 'full',
				w: '75%',
				maxW: '5xl',
				borderRadius: 'full',
				backgroundImage: 'linear-gradient(to right, rgba(var(--brand-primary), 0.2), rgba(255,255,255,0.4), rgba(var(--brand-secondary), 0.2))',
				filter: 'blur(160px)',
				opacity: '0.3',
				_dark: {
					backgroundImage: 'linear-gradient(to right, rgba(var(--brand-primary), 0.4), rgba(17,24,39,0.4), rgba(var(--brand-secondary), 0.4))',
				},
			})"></div>
		</div>
		<div :class="cx('glass-panel', css({ position: 'relative', mx: 'auto', maxW: '7xl', borderRadius: '3xl', px: '4', py: '12', sm: { px: '10' } }))">
			<div :class="css({ mb: '10', lg: { mb: '16' }, textAlign: 'center' })">
				<h2 :class="css({ mb: '4', fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight', color: { base: 'gray.900', _dark: 'white' }, md: { fontSize: '4xl' } })">{{ title }}</h2>
				<p :class="css({ color: { base: 'gray.600', _dark: 'gray.300' }, sm: { fontSize: 'xl' }, maxW: '3xl', mx: 'auto' })">{{ description }}</p>
			</div>
			<div :class="css({
				display: 'flex',
				flexDirection: 'column',
				gap: '6',
				md: {
					display: 'grid',
					gridTemplateColumns: '2',
					gap: '6',
				},
				lg: {
					gridTemplateColumns: '3',
				},
			})">
				<div
					v-for="item in segments"
					:class="cx('glass-card', css({
						borderRadius: '2xl',
						p: '6',
						transition: 'all',
						_hover: {
							transform: 'translateY(-2px)',
							borderColor: 'colorPalette.default/40',
							shadow: '0 30px 60px rgba(95,94,215,0.25)',
						},
					}))"
				>
					<div :class="css({
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						mb: '4',
						w: '12',
						h: '12',
						borderRadius: '2xl',
						backgroundImage: { base: 'linear-gradient(to bottom right, rgba(var(--brand-primary), 0.15), rgba(var(--brand-secondary), 0.15))', _dark: 'linear-gradient(to bottom right, rgba(var(--brand-primary), 0.25), rgba(var(--brand-secondary), 0.25))' },
						shadow: 'inset 0 1px 2px rgba(255,255,255,0.3)',
					})">
						<span :class="css({ fontSize: '2xl' })">{{ item.emoji || "😼" }}</span>
					</div>
					<h3 :class="css({ mb: '2', fontSize: 'xl', fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' } })">{{ item.title }}</h3>
					<p :class="css({ color: { base: 'gray.600', _dark: 'gray.300' }, lineHeight: 'relaxed' })">{{ item.description }}</p>
				</div>
			</div>
		</div>
	</section>
</template>
