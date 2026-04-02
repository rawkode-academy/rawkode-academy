<script setup lang="ts">
import { css } from "../../../../styled-system/css";

interface PricingFeature {
	text: string;
	description: string;
}

interface PricingPlan {
	title: string;
	price: string;
	description: string;
	features: PricingFeature[];
	ctaText: string;
}

const maltPricingPlan: PricingPlan = {
	title: "Malt",
	price: "96,000",
	description:
		"Premier Partnership - Our highest tier of collaboration, featuring comprehensive support and maximum visibility.",
	ctaText: "Become a Premier Partner",
	features: [
		{
			text: "Everything in Blend",
			description: "All features from the Blend partnership tier",
		},
		{
			text: "80 Hours of Consulting or Content Creation",
			description:
				"Extensive dedicated time for strategic consulting, product positioning, and premium content development",
		},
		{
			text: "Executive Advisory Sessions",
			description:
				"Direct access to our team for strategic guidance and industry insights",
		},
		{
			text: "Co-Marketing Opportunities",
			description:
				"Joint marketing initiatives including co-branded content, webinars, and promotional campaigns",
		},
	],
};

const wrapper = css({
	my: '4',
	mb: '12',
	borderWidth: '4px',
	borderColor: 'colorPalette.default',
	bg: { base: 'white', _dark: 'gray.800' },
	rounded: 'lg',
	shadow: 'sm',
	lg: { display: 'grid', gridTemplateColumns: '3' },
	transition: 'all',
	transitionDuration: '300ms',
	_hover: { shadow: '2xl', transform: 'scale(1.02)' },
	position: 'relative',
});

const premierBadge = css({
	position: 'absolute',
	top: '-4',
	left: '50%',
	transform: 'translateX(-50%)',
	bg: 'colorPalette.default',
	color: 'white',
	px: '4',
	py: '1',
	rounded: 'full',
	fontSize: 'sm',
	fontWeight: 'bold',
});

const contentArea = css({
	gridColumn: 'span 2',
	p: { base: '6', lg: '8' },
});

const title = css({
	mb: '3',
	fontSize: '3xl',
	fontWeight: 'bold',
	color: { base: 'gray.900', _dark: 'white' },
});

const description = css({
	fontSize: 'lg',
	fontWeight: 'medium',
	color: { base: 'gray.700', _dark: 'gray.300' },
	mb: '6',
});

const featureGrid = css({
	display: 'grid',
	gap: '4',
	mt: { base: '4', lg: '6' },
});

const featureList = css({
	display: 'flex',
	flexDir: 'column',
	gap: '6',
	color: { _dark: 'white' },
});

const featureItem = css({
	display: 'flex',
	alignItems: 'flex-start',
	gap: '3',
});

const featureIcon = css({
	flexShrink: '0',
	w: '5',
	h: '5',
	mt: '1',
	color: 'colorPalette.default',
});

const featureTitle = css({
	fontWeight: 'medium',
	color: { base: 'gray.800', _dark: 'gray.200' },
});

const featureDesc = css({
	fontSize: 'sm',
	color: { base: 'gray.600', _dark: 'gray.400' },
	mt: '1',
});

const sidebar = css({
	display: 'flex',
	p: { base: '6', lg: '8' },
	textAlign: 'center',
	bg: { base: 'gray.50', _dark: 'gray.700' },
});

const sidebarInner = css({
	alignSelf: 'center',
	w: 'full',
});

const priceValue = css({
	fontSize: '5xl',
	fontWeight: 'extrabold',
	color: { base: 'gray.900', _dark: 'white' },
});

const priceLabel = css({
	mt: '1',
	mb: '6',
	color: { base: 'gray.500', _dark: 'gray.400' },
	fontWeight: 'light',
});

const sidebarDesc = css({
	mb: '6',
	fontSize: 'sm',
	color: { base: 'gray.600', _dark: 'gray.300' },
});

const ctaButton = css({
	display: 'flex',
	justifyContent: 'center',
	color: 'white',
	bg: 'colorPalette.default',
	_hover: { bg: 'colorPalette.default' },
	focusRing: '4px',
	fontWeight: 'medium',
	rounded: 'lg',
	fontSize: 'sm',
	px: '5',
	py: '3',
	textAlign: 'center',
	transition: 'colors',
	transitionDuration: '300ms',
});
</script>

<template>
	<div :class="wrapper">
		<div :class="premierBadge">
			Premier Partnership
		</div>
		<div :class="contentArea">
			<h2 :class="title">{{ maltPricingPlan.title }}</h2>
			<p :class="description">{{ maltPricingPlan.description }}</p>
			<div :class="featureGrid">
				<!-- List -->
				<ul role="list" :class="featureList">
					<li v-for="feature in maltPricingPlan.features" :class="featureItem">
						<!-- Icon -->
						<svg :class="featureIcon" fill="currentColor" viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg">
							<path fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"></path>
						</svg>
						<div>
							<span :class="featureTitle">{{ feature.text }}</span>
							<p :class="featureDesc">
								{{ feature.description }}
							</p>
						</div>
					</li>
				</ul>
			</div>
		</div>
		<div :class="sidebar">
			<div :class="sidebarInner">
				<div :class="priceValue">{{ maltPricingPlan.price }}</div>
				<div :class="priceLabel">USD / annually</div>
				<div :class="sidebarDesc">
					Maximize your developer engagement and product adoption with our most comprehensive partnership tier
				</div>
				<a href="/organizations/lets-chat" :class="ctaButton">
					{{ maltPricingPlan.ctaText }}
				</a>
			</div>
		</div>
	</div>
</template>
