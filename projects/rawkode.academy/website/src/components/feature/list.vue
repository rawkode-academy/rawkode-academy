<script setup lang="ts">
import { css } from "../../../styled-system/css";

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
	<section :class="css({ position: 'relative', px: '4', py: { base: '12', sm: '20' } })">
		<div :class="css({ pointerEvents: 'none', position: 'absolute', inset: '0', display: 'flex', justifyContent: 'center' })">
			<div :class="css({ h: 'full', w: '3/4', maxW: '5xl', rounded: 'full', background: 'linear-gradient(to right, rgba(var(--brand-primary),0.2), rgba(255,255,255,0.4), rgba(var(--brand-secondary),0.2))', filter: 'blur(160px)', opacity: 0.3, _dark: { background: 'linear-gradient(to right, rgba(var(--brand-primary),0.4), rgba(17,24,39,0.4), rgba(var(--brand-secondary),0.4))' } })"></div>
		</div>
		<div class="glass-panel" :class="css({ position: 'relative', mx: 'auto', maxW: '7xl', rounded: '3xl', px: { base: '4', sm: '10' }, py: '12' })">
			<div :class="css({ mb: { base: '10', lg: '16' }, textAlign: 'center' })">
				<h2 :class="css({ mb: '4', fontSize: { base: '3xl', md: '4xl' }, fontWeight: 'bold', letterSpacing: 'tight', color: { base: 'gray.900', _dark: 'white' } })">{{ title }}</h2>
				<p :class="css({ color: { base: 'gray.600', _dark: 'gray.300' }, fontSize: { sm: 'xl' }, maxW: '3xl', mx: 'auto' })">{{ description }}</p>
			</div>
			<div :class="css({ display: 'flex', flexDirection: 'column', gap: '6', md: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6' }, lg: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } })">
				<div
					v-for="item in segments"
					class="glass-card"
					:class="css({ rounded: '2xl', p: '6', transition: 'all', transitionDuration: '200ms', _hover: { transform: 'translateY(-2px)', borderColor: 'rgba(var(--brand-primary),0.4)', boxShadow: '0 30px 60px rgba(95,94,215,0.25)' } })"
				>
					<div :class="css({ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: '4', w: '12', h: '12', rounded: '2xl', background: 'linear-gradient(to bottom right, rgba(var(--brand-primary),0.15), rgba(var(--brand-secondary),0.15))', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)', _dark: { background: 'linear-gradient(to bottom right, rgba(var(--brand-primary),0.25), rgba(var(--brand-secondary),0.25))' } })">
						<span :class="css({ fontSize: '2xl' })">{{ item.emoji || "😼" }}</span>
					</div>
					<h3 :class="css({ mb: '2', fontSize: 'xl', fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' } })">{{ item.title }}</h3>
					<p :class="css({ color: { base: 'gray.600', _dark: 'gray.300' }, lineHeight: 'relaxed' })">{{ item.description }}</p>
				</div>
			</div>
		</div>
	</section>
</template>
