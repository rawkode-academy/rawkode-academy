<script setup lang="ts">
import { Dialog } from "@ark-ui/vue/dialog";
import { onMounted, onUnmounted, ref } from "vue";
import { academyShell } from "../recipes/academyShell";

interface NavigationGroup {
	label: string;
	items: Array<{ label: string; href: string }>;
}

const props = withDefaults(defineProps<{
	groups: NavigationGroup[];
	currentPath?: string;
	id?: string;
}>(), { currentPath: "/", id: "academy-navigation" });
const styles = academyShell();
const open = ref(false);
const mounted = ref(false);
let desktop: MediaQueryList | undefined;
const closeOnDesktop = () => {
	if (desktop?.matches) open.value = false;
};
const isCurrent = (href: string) => href === "/"
	? props.currentPath === "/"
	: props.currentPath === href || props.currentPath.startsWith(`${href}/`);

onMounted(() => {
	mounted.value = true;
	desktop = window.matchMedia("(min-width: 1024px)");
	desktop.addEventListener("change", closeOnDesktop);
});
onUnmounted(() => desktop?.removeEventListener("change", closeOnDesktop));
</script>

<template>
	<div :class="styles.mobile">
		<!-- Until hydration, this real link reaches the complete footer nav. -->
		<a v-if="!mounted" href="#academy-footer-navigation" :class="styles.menuTrigger" aria-label="Open navigation">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
		</a>
		<Dialog.Root v-else :id="props.id" :open="open" @open-change="open = $event.open" :modal="true" :trap-focus="true" :prevent-scroll="true" :close-on-escape="true" :close-on-interact-outside="true">
			<Dialog.Trigger :class="styles.menuTrigger" aria-label="Open navigation">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
			</Dialog.Trigger>
			<Teleport to="body">
				<Dialog.Backdrop :class="styles.backdrop" />
				<Dialog.Positioner :class="styles.positioner">
					<Dialog.Content :class="styles.panel">
						<div :class="styles.panelHeader">
							<Dialog.Title :class="styles.panelTitle">Explore the Academy</Dialog.Title>
							<Dialog.CloseTrigger :class="styles.close" aria-label="Close navigation">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
							</Dialog.CloseTrigger>
						</div>
						<nav aria-label="Mobile navigation" :class="styles.menuGroups">
							<section v-for="(group, index) in props.groups" :key="group.label" :aria-labelledby="`${props.id}-group-${index}`">
								<h2 :id="`${props.id}-group-${index}`" :class="styles.menuHeading">{{ group.label }}</h2>
								<ul :class="styles.menuGroup">
									<li v-for="item in group.items" :key="item.href">
										<a :href="item.href" :class="styles.menuLink" :aria-current="isCurrent(item.href) ? 'page' : undefined" @click="open = false">{{ item.label }}</a>
									</li>
								</ul>
							</section>
						</nav>
					</Dialog.Content>
				</Dialog.Positioner>
			</Teleport>
		</Dialog.Root>
	</div>
</template>
