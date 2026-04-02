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

const sectionStyle = css({ bg: { base: 'white', _dark: 'gray.900' } });
const outerStyle = css({ px: '4', mx: 'auto', maxW: 'breakpoint-xl', lg: { px: '6' } });
const titleWrapStyle = css({ mx: 'auto', maxW: 'breakpoint-md', textAlign: 'center' });
const titleStyle = css({ fontSize: { base: '3xl', md: '4xl' }, letterSpacing: 'tight', fontWeight: 'extrabold', color: { base: 'gray.900', _dark: 'white' } });
const gridWrapStyle = css({ maxW: 'breakpoint-xl', px: '4', mx: 'auto', textAlign: 'center', lg: { py: '16', px: '6' } });
const gridStyle = css({ display: 'grid', maxW: 'breakpoint-md', gap: '8', mx: 'auto', color: { base: 'gray.900', _dark: 'white' }, sm: { gridTemplateColumns: '3' } });
const itemStyle = css({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' });
const valueStyle = css({ mb: '2', fontSize: { base: '4xl', md: '5xl' }, fontWeight: 'extrabold' });
const labelStyle = css({ fontWeight: 'light', color: { base: 'gray.500', _dark: 'gray.400' } });
</script>

<template>
	<section :class="sectionStyle">
		<div :class="outerStyle">
			<div :class="titleWrapStyle">
				<h2 :class="titleStyle">{{ title }}</h2>
			</div>
			<div :class="gridWrapStyle">
				<dl :class="gridStyle">
					<div v-for="stat in stats" :class="itemStyle">
						<dt :class="valueStyle">{{ stat.value }}</dt>
						<dd :class="labelStyle">{{ stat.label }}</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>
</template>
