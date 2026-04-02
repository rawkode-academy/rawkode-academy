<script setup lang="ts">
import { css } from "../../../../styled-system/css";

interface PricingFeature {
	text: string;
	description?: string;
}

interface PricingPlan {
	title: string;
	price: string;
	description: string;
	features: PricingFeature[];
	ctaText: string;
	popular?: boolean;
}

const pricingPlans: PricingPlan[] = [
	{
		title: "Nip",
		price: "12,000",
		description:
			"Essential visibility and quarterly engagement with our developer community.",
		ctaText: "Get Started",
		features: [
			{
				text: "Featured Partner Placement",
				description:
					"Your brand prominently displayed on our homepage and partners page with company description and industry classification",
			},
			{
				text: "Quarterly Live Stream",
				description:
					"Collaborative live coding sessions or product demonstrations to showcase your technology",
			},
			{
				text: "Social Media Promotion",
				description:
					"Mentions across our social channels highlighting your partnership",
			},
		],
	},
	{
		title: "Dram",
		price: "24,000",
		description:
			"Targeted developer outreach with customized content creation to showcase your technology.",
		ctaText: "Grow Together",
		popular: true,
		features: [
			{
				text: "Everything in Nip",
				description: "All features from the Nip partnership tier",
			},
			{
				text: "32 Hours of Consulting or Content",
				description:
					"Dedicated time for strategic consulting or creating tailored content that highlights your product",
			},
			{
				text: "Quarterly Strategy Sessions",
				description:
					"Regular meetings to align content and engagement with your business goals",
			},
		],
	},
	{
		title: "Blend",
		price: "48,000",
		description:
			"Extensive collaboration with significant developer engagement opportunities and strategic guidance.",
		ctaText: "Accelerate Growth",
		features: [
			{
				text: "Everything in Dram",
				description: "All features from the Dram partnership tier",
			},
			{
				text: "64 Hours of Consulting or Content",
				description:
					"Expanded dedicated time for strategic consulting or creating premium content",
			},
			{
				text: "Go-to-Market Strategy Support",
				description:
					"Expert guidance on positioning your product for developer adoption",
			},
			{
				text: "Priority Content Calendar Placement",
				description:
					"Preferred scheduling for your content and promotional activities",
			},
		],
	},
];

const gridStyle = css({
	display: 'flex',
	flexDir: 'column',
	gap: '8',
	lg: {
		display: 'grid',
		gridTemplateColumns: '3',
	},
	sm: { gap: '6' },
	xl: { gap: '10' },
});

const cardBase = css({
	display: 'flex',
	flexDir: 'column',
	p: { base: '6', xl: '8' },
	mx: 'auto',
	maxW: 'lg',
	textAlign: 'center',
	color: { base: 'gray.900', _dark: 'white' },
	bg: { base: 'white', _dark: 'gray.800' },
	rounded: 'lg',
	border: '1px solid',
	borderColor: { base: 'gray.100', _dark: 'gray.600' },
	shadow: 'sm',
	transition: 'all',
	transitionDuration: '300ms',
	_hover: { shadow: 'xl', transform: 'scale(1.02)' },
});

const cardPopular = css({
	borderColor: 'colorPalette.default',
	borderWidth: '2px',
	position: 'relative',
});

const popularBadge = css({
	position: 'absolute',
	top: '0',
	right: '0',
	px: '3',
	py: '1',
	bg: 'colorPalette.default',
	color: 'white',
	fontSize: 'xs',
	fontWeight: 'semibold',
	roundedBottomLeft: 'lg',
	roundedTopRight: 'lg',
});

const planTitle = css({ mb: '4', fontSize: '2xl', fontWeight: 'semibold' });
const planDesc = css({ minH: '24', fontWeight: 'light', color: { base: 'gray.500', _dark: 'gray.400' }, fontSize: { sm: 'lg' } });
const priceWrap = css({ display: 'grid', justifyContent: 'center', my: '8' });
const priceValue = css({ fontSize: '5xl', fontWeight: 'extrabold' });
const priceLabel = css({ color: { base: 'gray.500', _dark: 'gray.400' } });
const featureList = css({ mb: '8', display: 'flex', flexDir: 'column', gap: '4', textAlign: 'left', minH: '64' });
const featureItem = css({ display: 'flex', alignItems: 'flex-start', gap: '3', mb: '4' });
const featureIcon = css({ flexShrink: '0', w: '5', h: '5', mt: '1', color: { base: 'green.500', _dark: 'green.400' } });
const featureTitle = css({ fontWeight: 'medium', color: { base: 'gray.800', _dark: 'gray.200' } });
const featureDesc = css({ fontSize: 'sm', color: { base: 'gray.500', _dark: 'gray.400' }, mt: '1' });
const ctaButton = css({
	color: 'white',
	bg: 'colorPalette.default',
	_hover: { bg: 'colorPalette.default' },
	focusRing: '4px',
	fontWeight: 'medium',
	rounded: 'lg',
	fontSize: 'sm',
	px: '5',
	py: '2.5',
	textAlign: 'center',
	mt: 'auto',
});
</script>

<template>
	<div :class="gridStyle">
		<div v-for="plan in pricingPlans"
			:class="[cardBase, plan.popular ? cardPopular : '']">

			<div v-if="plan.popular"
				:class="popularBadge">
				Popular Choice
			</div>

			<h3 :class="planTitle">{{ plan.title }}</h3>
			<p :class="planDesc">{{
				plan.description }}</p>
			<div :class="priceWrap">
				<div :class="priceValue">{{ plan.price }}</div>
				<div :class="priceLabel">USD / annually</div>
			</div>

			<!-- List -->
			<ul role="list" :class="featureList">
				<li v-for="feature in plan.features" :class="featureItem">
					<!-- Icon -->
					<svg :class="featureIcon" fill="currentColor"
						viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
						<path fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"></path>
					</svg>
					<div>
						<span :class="featureTitle">{{ feature.text }}</span>
						<p v-if="feature.description" :class="featureDesc">
							{{ feature.description }}
						</p>
					</div>
				</li>
			</ul>

			<a href="/organizations/lets-chat"
				:class="ctaButton">
				{{ plan.ctaText }}
			</a>
		</div>
	</div>
</template>
