<script setup lang="ts">
import { css } from "../../../styled-system/css";

interface Props {
	title: string;
	stats: Stat[];
}

interface Stat {
	label: string;
	value: string;
}

defineProps<Props>();
</script>

<template>
	<section :class="css({ bg: { base: 'white', _dark: 'gray.900' } })">
		<div :class="css({ px: { base: '4', lg: '6' }, mx: 'auto', maxW: '7xl', xl: { px: '0' } })">
			<div :class="css({ mx: 'auto', maxW: '3xl', textAlign: 'center' })">
				<h2 :class="css({ fontSize: { base: '3xl', md: '4xl' }, letterSpacing: 'tight', fontWeight: 'extrabold', color: { base: 'gray.900', _dark: 'white' } })">{{ title }}</h2>
			</div>
			<div :class="css({ maxW: '7xl', px: '4', mx: 'auto', textAlign: 'center', lg: { py: '16', px: '6' } })">
				<dl :class="css({ display: 'grid', maxW: '3xl', gap: '8', mx: 'auto', color: { base: 'gray.900', _dark: 'white' }, sm: { gridTemplateColumns: 'repeat(3, 1fr)' } })">
					<div v-for="stat in stats" :class="css({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' })">
						<dt :class="css({ mb: '2', fontSize: { base: '4xl', md: '5xl' }, fontWeight: 'extrabold' })">{{ stat.value }}</dt>
						<dd :class="css({ fontWeight: 'light', color: { base: 'gray.500', _dark: 'gray.400' } })">{{ stat.label }}</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>
</template>
