<script setup lang="ts">
import { reactive } from "vue";
import { css } from "styled-system/css";

// Track analytics events client-side
const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

interface AccordionItem {
	id: string;
	question: string;
	answer?: string;
}

interface Props {
	items: AccordionItem[];
	defaultOpenId?: string;
}

const props = defineProps<Props>();

// Use reactive state instead of Set for better reactivity
const openItems = reactive<Record<string, boolean>>(
	props.defaultOpenId ? { [props.defaultOpenId]: true } : {},
);

const toggleItem = (id: string) => {
	const wasOpen = openItems[id];
	openItems[id] = !openItems[id];
	// Track accordion toggle
	trackEvent("accordion_toggled", {
		item_id: id,
		action: wasOpen ? "collapsed" : "expanded",
	});
};

const isOpen = (id: string) => !!openItems[id];
</script>

<template>
	<div :class="css({ w: 'full' })">
		<div v-for="item in items" :key="item.id">
			<h2 :id="`accordion-heading-${item.id}`">
				<button
					type="button"
					:class="[
						css({
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							py: '5',
							px: '4',
							w: 'full',
							fontWeight: 'medium',
							textAlign: 'left',
							borderBottom: '1px solid',
							borderColor: { base: 'white/20', _dark: 'gray.700/40' },
							transition: 'all',
							transitionDuration: '200ms',
							roundedTop: 'xl',
							_hover: {
								bg: { base: 'white/40', _dark: 'gray.800/40' },
								backdropFilter: 'blur(12px)',
							},
						}),
						isOpen(item.id)
							? css({
								color: { base: 'gray.900', _dark: 'white' },
								bg: { base: 'white/30', _dark: 'gray.800/30' },
								backdropFilter: 'blur(12px)',
							})
							: css({
								color: { base: 'gray.500', _dark: 'gray.400' },
							}),
					]"
					@click="toggleItem(item.id)"
					:aria-expanded="isOpen(item.id)"
					:aria-controls="`accordion-body-${item.id}`"
				>
					<span>{{ item.question }}</span>
					<svg
						:class="[
							css({
								w: '6',
								h: '6',
								flexShrink: '0',
								transition: 'transform',
								transitionDuration: '200ms',
							}),
							isOpen(item.id) ? css({ transform: 'rotate(180deg)' }) : '',
						]"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							fill-rule="evenodd"
							d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
							clip-rule="evenodd"
						></path>
					</svg>
				</button>
			</h2>
			<Transition
				enter-active-class="transition-all duration-200 ease-out"
				leave-active-class="transition-all duration-200 ease-out"
				enter-from-class="opacity-0 max-h-0"
				enter-to-class="opacity-100 max-h-screen"
				leave-from-class="opacity-100 max-h-screen"
				leave-to-class="opacity-0 max-h-0"
			>
				<div
					v-show="isOpen(item.id)"
					:id="`accordion-body-${item.id}`"
					:aria-labelledby="`accordion-heading-${item.id}`"
					role="region"
					:class="css({ overflow: 'hidden' })"
				>
					<div :class="css({
						py: '5',
						px: '4',
						borderBottom: '1px solid',
						borderColor: { base: 'white/20', _dark: 'gray.700/40' },
						bg: { base: 'white/20', _dark: 'gray.800/20' },
						backdropFilter: 'blur(4px)',
					})">
						<div :class="css({ color: { base: 'gray.600', _dark: 'gray.300' } })">
							<slot :name="`answer-${item.id}`">
								{{ item.answer }}
							</slot>
						</div>
					</div>
				</div>
			</Transition>
		</div>
	</div>
</template>
