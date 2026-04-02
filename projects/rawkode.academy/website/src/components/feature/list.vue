<script setup lang="ts">
import { css, cx } from "styled-system/css";
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
	<section :class="css({ pos: 'relative', px: '4', py: '12', sm: { py: '20' } })">
		<div :class="css({ pointerEvents: 'none', pos: 'absolute', inset: '0', display: 'flex', justifyContent: 'center' })">
			<div :class="css({ h: 'full', w: '75%', maxW: '5xl', rounded: 'full', bgGradient: 'to-r', gradientFrom: 'primary/20', gradientVia: 'white/40', gradientTo: 'secondary/20', filter: 'blur(160px)', opacity: '0.3', _dark: { gradientFrom: 'primary/40', gradientVia: 'gray.900/40', gradientTo: 'secondary/40' } })"></div>
		</div>
		<div :class="cx('glass-panel', css({ pos: 'relative', mx: 'auto', maxW: '7xl', rounded: '3xl', px: '4', py: '12', sm: { px: '10' } }))">
			<div :class="css({ mb: '10', lg: { mb: '16' }, textAlign: 'center' })">
				<h2 :class="css({ mb: '4', fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight', color: { base: 'gray.900', _dark: 'white' }, md: { fontSize: '4xl' } })">{{ title }}</h2>
				<p :class="css({ color: { base: 'gray.600', _dark: 'gray.300' }, sm: { fontSize: 'xl' }, maxW: '3xl', mx: 'auto' })">{{ description }}</p>
			</div>
			<div :class="css({ '& > * + *': { mt: '6' }, md: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6', '& > * + *': { mt: '0' } }, lg: { gridTemplateColumns: 'repeat(3, 1fr)' } })">
				<div
					v-for="item in segments"
					:class="cx('glass-card', css({ rounded: '2xl', p: '6', transition: 'all', _hover: { transform: 'translateY(-2px)', borderColor: 'primary/40', shadow: '0 30px 60px rgba(95,94,215,0.25)' } }))"
					class="group"
				>
					<div :class="css({ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: '4', w: '12', h: '12', rounded: '2xl', bgGradient: 'to-br', gradientFrom: 'primary/15', gradientTo: 'secondary/15', _dark: { gradientFrom: 'primary/25', gradientTo: 'secondary/25' }, shadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' })">
						<span :class="css({ fontSize: '2xl' })">{{ item.emoji || "😼" }}</span>
					</div>
					<h3 :class="css({ mb: '2', fontSize: 'xl', fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' } })">{{ item.title }}</h3>
					<p :class="css({ color: { base: 'gray.600', _dark: 'gray.300' }, lineHeight: 'relaxed' })">{{ item.description }}</p>
				</div>
			</div>
		</div>
	</section>
</template>
