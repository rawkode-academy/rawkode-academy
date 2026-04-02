<script setup lang="ts">
import Card from "../ui/Card.vue";
import Badge from "../common/Badge.vue";
import { css } from "../../../styled-system/css";

interface Author {
	name: string;
	handle: string;
}

interface Props {
	id: string;
	title: string;
	subtitle?: string;
	cover?: {
		image: string;
		alt: string;
	};
	authors: Author[];
	publishedAt: Date;
	readingTimeText?: string;
}

defineProps<Props>();

const imgStyle = css({ w: 'full', h: '52', objectFit: 'cover' });
const overlayStyle = css({ position: 'absolute', inset: '0', bgGradient: 'to-tr', gradientFrom: 'colorPalette.default/30', gradientTo: 'colorPalette.default/20', mixBlendMode: 'multiply' });
const contentStyle = css({ p: '6' });
const titleStyle = css({ mb: '3', fontSize: 'xl', fontWeight: 'bold', letterSpacing: 'tight', lineClamp: '2' });
const subtitleStyle = css({ mb: '4', fontWeight: 'light', lineClamp: '3' });
const footerWrapStyle = css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
const authorsWrapStyle = css({ display: 'flex', alignItems: 'center', gap: '3' });
const avatarGroupStyle = css({ display: 'flex' });
const avatarImgStyle = css({ w: '10', h: '10', borderRadius: 'full', objectFit: 'cover', borderWidth: '2px', borderColor: 'colorPalette.default', p: '0.5', bg: { base: 'white', _dark: 'gray.800' } });
const indicatorStyle = css({ position: 'absolute', bottom: '0', right: '0', h: '2.5', w: '2.5', bg: 'colorPalette.default', borderRadius: 'full', borderWidth: '2px', borderColor: { base: 'white', _dark: 'gray.700' } });
const overflowStyle = css({ w: '10', h: '10', borderRadius: 'full', bg: 'colorPalette.default/10', borderWidth: '2px', borderColor: 'colorPalette.default', p: '0.5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'xs', color: { base: 'colorPalette.default', _dark: 'colorPalette.default' }, fontWeight: 'medium' });
const authorNameStyle = css({ fontWeight: 'medium' });
const authorTextStyle = css({ fontSize: 'sm' });
const metaStyle = css({ display: 'flex', alignItems: 'center', gap: '3', fontSize: 'xs' });
const metaItemStyle = css({ display: 'flex', alignItems: 'center', gap: '1' });
const svgSmStyle = css({ h: '4', w: '4' });
const svgPrimaryStyle = css({ h: '4', w: '4', color: 'colorPalette.default' });
</script>

<template>
	<Card :href="`/read/${id}`" variant="glass" padding="none">
		<template #badge>
			<Badge variant="primary" size="sm">Article</Badge>
		</template>

		<template #media>
			<img
				v-if="cover"
				:class="imgStyle"
				:src="cover.image"
				:alt="cover.alt"
				loading="lazy"
			/>
			<img
				v-else
				:class="imgStyle"
				src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/blog/office-laptops.png"
				alt="Default placeholder image for article without custom cover"
				loading="lazy"
			/>
		</template>

		<template #overlay>
			<div :class="overlayStyle"></div>
		</template>

		<div :class="contentStyle">
			<h2 :class="titleStyle" class="text-primary-content">
				{{ title }}
			</h2>
			<p v-if="subtitle" :class="subtitleStyle" class="text-secondary-content">
				{{ subtitle }}
			</p>
		</div>

		<template #footer>
			<div :class="footerWrapStyle">
				<div :class="authorsWrapStyle">
					<div :class="avatarGroupStyle" style="margin-left: -0.75rem;">
						<div
							v-for="(author, index) in authors.slice(0, 3)"
							:key="author.handle"
							style="position: relative;"
							:style="`z-index: ${10 - index}`"
						>
							<img
								:class="avatarImgStyle"
								:src="`https://avatars.githubusercontent.com/${author.handle}`"
								:alt="`Profile picture of ${author.name}`"
								loading="lazy"
							/>
							<span
								v-if="index === 0"
								:class="indicatorStyle"
							></span>
						</div>
						<div v-if="authors.length > 3" style="position: relative; z-index: 0;">
							<div :class="overflowStyle">
								+{{ authors.length - 3 }}
							</div>
						</div>
					</div>
					<div :class="authorNameStyle" class="text-primary-content">
						<div :class="authorTextStyle">{{ authors.map(a => a.name).join(", ") }}</div>
					</div>
				</div>
				<div :class="metaStyle" class="text-muted">
					<div v-if="readingTimeText" :class="metaItemStyle">
						<svg xmlns="http://www.w3.org/2000/svg" :class="svgSmStyle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						{{ readingTimeText }}
					</div>
					<div :class="metaItemStyle">
						<svg xmlns="http://www.w3.org/2000/svg" :class="svgPrimaryStyle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						{{ new Intl.DateTimeFormat('en-US', {
							year: 'numeric',
							month: 'short',
							day: 'numeric'
						}).format(new Date(publishedAt)) }}
					</div>
				</div>
			</div>
		</template>
	</Card>
</template>
