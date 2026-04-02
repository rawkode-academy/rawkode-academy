<template>
	<div :class="css({ bg: { base: 'white', _dark: 'gray.900' }, py: { base: '24', sm: '32' } })">
		<div :class="css({ mx: 'auto', px: { base: '6', lg: '8' } })">
			<div :class="css({ mx: 'auto', lg: { textAlign: 'center' } })">
				<h2>Deploy faster</h2>
				<p :class="css({ mt: '2', fontSize: { base: '3xl', sm: '4xl' }, fontWeight: 'bold', letterSpacing: 'tight', color: 'gray.900' })">Everything you need to deploy your app</p>
				<p :class="css({ mt: '6', fontSize: 'lg', lineHeight: '2', color: 'gray.600' })">Quis tellus eget adipiscing convallis sit sit eget aliquet quis. Suspendisse eget egestas a elementum pulvinar et feugiat blandit at. In mi viverra elit nunc.</p>
			</div>
			<div :class="css({ mx: 'auto', mt: { base: '16', sm: '20', lg: '24' } })">
				<dl :class="css({ display: 'grid', gridTemplateColumns: { base: '1fr', lg: 'repeat(2, 1fr)' }, columnGap: '8', rowGap: { base: '10', lg: '16' } })">
					<div v-for="feature in features" :key="feature.name" :class="css({ position: 'relative', pl: '16' })">
						<dt :class="css({ fontSize: 'base', fontWeight: 'semibold', lineHeight: '1.75', color: { base: 'gray.900', _dark: 'white' } })">
							<div :class="css({ position: 'absolute', left: '0', top: '0', display: 'flex', h: '10', w: '10', alignItems: 'center', justifyContent: 'center', rounded: 'lg', bg: 'colorPalette.default' })">
								<component :is="feature.icon" :class="css({ h: '6', w: '6', color: 'white' })" aria-hidden="true" />
							</div>
							{{ feature.name }}
						</dt>
						<dd :class="css({ mt: '2', fontSize: 'base', lineHeight: '1.75', color: { base: 'gray.600', _dark: 'gray.400' } })">{{ feature.description }}</dd>
					</div>
				</dl>
			</div>
		</div>
	</div>
</template>

<script setup>
import { css } from "../../../styled-system/css";
import {
	ArrowPathIcon,
	CloudArrowUpIcon,
	FingerPrintIcon,
	LockClosedIcon,
} from "@heroicons/vue/24/outline";

const features = [
	{
		name: "Push to deploy",
		description:
			"Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse semper morbi. Odio urna massa nunc massa.",
		icon: CloudArrowUpIcon,
	},
	{
		name: "SSL certificates",
		description:
			"Sit quis amet rutrum tellus ullamcorper ultricies libero dolor eget. Sem sodales gravida quam turpis enim lacus amet.",
		icon: LockClosedIcon,
	},
	{
		name: "Simple queues",
		description:
			"Quisque est vel vulputate cursus. Risus proin diam nunc commodo. Lobortis auctor congue commodo diam neque.",
		icon: ArrowPathIcon,
	},
	{
		name: "Advanced security",
		description:
			"Arcu egestas dolor vel iaculis in ipsum mauris. Tincidunt mattis aliquet hac quis. Id hac maecenas ac donec pharetra eget.",
		icon: FingerPrintIcon,
	},
];
</script>
