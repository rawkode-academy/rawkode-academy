<script setup lang="ts">
import { css } from "../../../styled-system/css";
import Card from "../ui/Card.vue";
import Badge from "../common/Badge.vue";

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

const imgStyle = css({
	w: 'full',
	h: '52',
	objectFit: 'cover',
});

const overlayStyle = css({
	position: 'absolute',
	inset: '0',
	bgGradient: 'to-tr',
	gradientFrom: 'brand.primary/30',
	gradientTo: 'brand.secondary/20',
	mixBlendMode: 'multiply',
});

const contentStyle = css({ p: '6' });

const titleStyle = css({
	mb: '3',
	fontSize: 'xl',
	fontWeight: 'bold',
	letterSpacing: 'tight',
	color: 'fg.default',
	lineClamp: '2',
});

const subtitleStyle = css({
	mb: '4',
	fontWeight: '300',
	color: 'fg.subtle',
	lineClamp: '3',
});

const footerStyle = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
});

const authorsContainerStyle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
});

const avatarsStackStyle = css({
	display: 'flex',
});

const avatarWrapperStyle = css({
	position: 'relative',
});

const avatarImgStyle = css({
	w: '10',
	h: '10',
	rounded: 'full',
	objectFit: 'cover',
	borderWidth: '2px',
	borderStyle: 'solid',
	borderColor: 'brand.primary',
	p: '0.5',
	bg: { base: 'white', _dark: 'gray.800' },
});

const onlineIndicatorStyle = css({
	position: 'absolute',
	bottom: '0',
	right: '0',
	h: '2.5',
	w: '2.5',
	bg: 'brand.secondary',
	rounded: 'full',
	borderWidth: '2px',
	borderStyle: 'solid',
	borderColor: { base: 'white', _dark: 'gray.700' },
});

const overflowAvatarStyle = css({
	w: '10',
	h: '10',
	rounded: 'full',
	bg: { base: 'brand.primary/10', _dark: 'brand.primary/20' },
	borderWidth: '2px',
	borderStyle: 'solid',
	borderColor: 'brand.primary',
	p: '0.5',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	fontSize: 'xs',
	color: { base: 'brand.primary', _dark: 'brand.secondary' },
	fontWeight: '500',
});

const authorNameStyle = css({
	fontWeight: '500',
	color: 'fg.default',
	fontSize: 'sm',
});

const metaStyle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
	fontSize: 'xs',
	color: 'fg.subtle',
});

const metaItemStyle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
});

const iconStyle = css({ h: '4', w: '4' });

const iconPrimaryStyle = css({
	h: '4',
	w: '4',
	color: 'brand.primary',
});
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
			<h2 :class="titleStyle">
				{{ title }}
			</h2>
			<p v-if="subtitle" :class="subtitleStyle">
				{{ subtitle }}
			</p>
		</div>

		<template #footer>
			<div :class="footerStyle">
				<div :class="authorsContainerStyle">
					<div :class="avatarsStackStyle">
						<div
							v-for="(author, index) in authors.slice(0, 3)"
							:key="author.handle"
							:class="avatarWrapperStyle"
							:style="`z-index: ${10 - index}; margin-left: ${index > 0 ? '-0.75rem' : '0'}`"
						>
							<img
								:class="avatarImgStyle"
								:src="`https://avatars.githubusercontent.com/${author.handle}`"
								:alt="`Profile picture of ${author.name}`"
								loading="lazy"
							/>
							<span
								v-if="index === 0"
								:class="onlineIndicatorStyle"
							></span>
						</div>
						<div v-if="authors.length > 3" :class="avatarWrapperStyle" style="z-index: 0; margin-left: -0.75rem;">
							<div :class="overflowAvatarStyle">
								+{{ authors.length - 3 }}
							</div>
						</div>
					</div>
					<div :class="authorNameStyle">
						<div>{{ authors.map(a => a.name).join(", ") }}</div>
					</div>
				</div>
				<div :class="metaStyle">
					<div v-if="readingTimeText" :class="metaItemStyle">
						<svg xmlns="http://www.w3.org/2000/svg" :class="iconStyle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						{{ readingTimeText }}
					</div>
					<div :class="metaItemStyle">
						<svg xmlns="http://www.w3.org/2000/svg" :class="iconPrimaryStyle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
