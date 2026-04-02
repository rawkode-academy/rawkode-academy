<script setup lang="ts">
import { css } from "../../../styled-system/css";

interface Offering {
	title: string;
	color: string;
	description: string;
	tagline: string;
	features: Array<{
		name: string;
		description: string;
	}>;
}

const offerings: Offering[] = [
	{
		title: "Developer Marketing",
		color: "primary",
		description: "We Inspire Developers",
		tagline: "Drive awareness and generate excitement around your technology",
		features: [
			{
				name: "Conference & User Group Speaking",
				description: "Expert representation at industry events",
			},
			{
				name: "Podcast Interviews",
				description: "Storytelling that highlights your product vision",
			},
			{
				name: "Product Reviews",
				description: "Authentic evaluations from a developer perspective",
			},
			{
				name: "Release Highlights",
				description: "Showcase new features and improvements",
			},
			{
				name: "Short-Form Content",
				description: "Engaging technical demonstrations",
			},
			{
				name: "Social Media Campaigns",
				description: "Targeted outreach to developer communities",
			},
			{
				name: "Thought Leadership",
				description: "Position your brand as an industry innovator",
			},
		],
	},
	{
		title: "Developer Education",
		color: "secondary",
		description: "We Level-Up Developers",
		tagline: "Build developer competency and confidence with your technology",
		features: [
			{
				name: "Writing",
				description: "In-depth technical articles and tutorials",
			},
			{
				name: "Hackathons",
				description: "Hands-on challenges that showcase your platform",
			},
			{
				name: "Live Coding",
				description: "Real-time implementation and problem-solving",
			},
			{
				name: "Long-Form Content",
				description: "Comprehensive guides and case studies",
			},
			{
				name: "Online Courses",
				description: "Structured learning paths for your technology",
			},
			{
				name: "Webinars",
				description: "Interactive demonstrations and Q&A sessions",
			},
			{
				name: "Workshops",
				description: "Guided implementation with expert instruction",
			},
		],
	},
	{
		title: "Developer Experience",
		color: "tertiary",
		description: "We Support Developers",
		tagline: "Optimize your product strategy for developer success",
		features: [
			{
				name: "Documentation Review",
				description: "Enhance clarity and completeness of technical guides",
			},
			{
				name: "Go-To-Market Strategy",
				description: "Developer-focused launch and adoption planning",
			},
			{
				name: "Product-Market Fit Analysis",
				description: "Identify opportunities to better serve developer needs",
			},
			{
				name: "Roadmap Consultation",
				description: "Strategic guidance on feature prioritization",
			},
			{
				name: "User Experience Testing",
				description: "Real-world feedback from developer perspective",
			},
		],
	},
];

const colorMap: Record<string, { bg: string; text: string }> = {
	primary: {
		bg: "rgb(var(--brand-primary))",
		text: "rgb(var(--brand-primary))",
	},
	secondary: {
		bg: "rgb(var(--brand-secondary))",
		text: "rgb(var(--brand-secondary))",
	},
	tertiary: {
		bg: "rgb(var(--brand-primary))",
		text: "rgb(var(--brand-primary))",
	},
};
</script>
<template>
	<section :class="css({ bg: { base: 'white', _dark: 'gray.900' } })">
		<div :class="css({ py: { base: '8', sm: '16' }, px: { base: '4', lg: '6' }, mx: 'auto', maxW: '7xl' })">
			<div :class="css({ maxW: '3xl', mb: { base: '8', lg: '16' } })">
				<h2 :class="css({ mb: '4', fontSize: '4xl', letterSpacing: 'tight', fontWeight: 'extrabold', color: { base: 'gray.900', _dark: 'white' } })">Partner With Industry
					Experts</h2>
				<p :class="css({ fontWeight: 'light', color: { base: 'gray.500', _dark: 'gray.400' }, fontSize: { sm: 'xl' } })">We carefully select partners whose
					technologies genuinely enhance developers' work and lives. Our authentic approach ensures we can effectively
					advocate for your solutions and help you reach your growth objectives.</p>
				<p :class="css({ mt: '4', color: { base: 'black', _dark: 'white' }, fontSize: { sm: 'xl' }, fontWeight: 'medium' })">Our three-pillar approach to developer
					engagement:</p>
			</div>
			<div :class="css({ display: 'flex', flexDirection: 'column', gap: '12', md: { display: 'grid', gridTemplateColumns: '1fr' }, lg: { gridTemplateColumns: 'repeat(3, 1fr)', gap: '8' }, xl: { gap: '12' } })">
				<div v-for="offer in offerings"
					:class="css({ p: '6', bg: { base: 'gray.50', _dark: 'gray.800' }, rounded: 'lg', border: '1px solid', borderColor: { base: 'gray.200', _dark: 'gray.700' }, shadow: 'sm', transition: 'all', transitionDuration: '300ms', _hover: { shadow: 'lg' } })">
					<div :class="css({ display: 'flex', alignItems: 'center', mb: '4' })">
						<div
							:class="css({ display: 'flex', justifyContent: 'center', alignItems: 'center', mr: '4', w: '12', h: '12', rounded: 'full', lg: { h: '14', w: '14' } })"
							:style="{ backgroundColor: colorMap[offer.color]?.bg || 'rgb(var(--brand-primary))' }">
							<svg :class="css({ w: '6', h: '6', color: 'white', lg: { w: '7', h: '7' } })" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"></path>
							</svg>
						</div>
						<div>
							<h3 :class="css({ fontSize: '2xl', fontWeight: 'bold', color: { base: 'gray.900', _dark: 'white' } })">{{ offer.title }}</h3>
							<p :class="css({ fontWeight: 'medium' })" :style="{ color: colorMap[offer.color]?.text || 'rgb(var(--brand-primary))' }">{{ offer.description }}</p>
						</div>
					</div>

					<p :class="css({ mb: '6', color: { base: 'gray.700', _dark: 'gray.300' } })">{{ offer.tagline }}</p>

					<ul role="list" :class="css({ display: 'flex', flexDirection: 'column', gap: '5' })">
						<li v-for="feature in offer.features" :class="css({ position: 'relative', pl: '8' })">
							<svg :class="css({ position: 'absolute', left: '0', top: '1', w: '5', h: '5' })"
								:style="{ color: colorMap[offer.color]?.text || 'rgb(var(--brand-primary))' }"
								fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"></path>
							</svg>
							<div>
								<span :class="css({ fontWeight: 'medium', color: { base: 'gray.900', _dark: 'white' } })">{{ feature.name }}</span>
								<p :class="css({ fontSize: 'sm', color: { base: 'gray.600', _dark: 'gray.400' } })">{{ feature.description }}</p>
							</div>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</section>
</template>
