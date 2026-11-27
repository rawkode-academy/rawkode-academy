<script setup lang="ts">
import { academyShell } from "@rawkodeacademy/design-system";
import { NavigationDrawer } from "@rawkodeacademy/design-system/vue";

defineProps<{
	name: string;
	orgs: { id: string; name: string }[];
	canViewAs: boolean;
	currentPath: string;
}>();

const styles = academyShell();
const primary = [{ label: "Collaborations", href: "/" }, { label: "Analytics", href: "/analytics" }];
</script>

<template>
	<NavigationDrawer :primary="primary" :groups="[]" :current-path="currentPath" id="portal-navigation">
		<template #account>
			<div :class="styles.menuAccount">
				<div :class="styles.menuIdentity">
					<span :class="styles.menuIdentityText">
						<span :class="styles.menuIdentityName">{{ name }}</span>
					</span>
					<form method="post" action="/logout"><button :class="styles.menuSignOut">Sign out</button></form>
				</div>
				<form v-if="canViewAs && orgs.length" method="post" action="/view-as" class="menu-view-as">
					<label for="menu-view-as">View as a partner</label>
					<select id="menu-view-as" name="target" onchange="this.form.requestSubmit()">
						<option value="">Choose a partner…</option>
						<option v-for="org in orgs" :key="org.id" :value="org.id">{{ org.name }}</option>
					</select>
				</form>
			</div>
		</template>
	</NavigationDrawer>
</template>

<style>
.menu-view-as { display: grid; gap: 0.375rem; margin-top: 1rem; font-family: var(--fonts-academy-text); font-size: 0.875rem; color: var(--colors-academy-text-soft); }
.menu-view-as select { font: inherit; background: var(--colors-academy-panel); color: var(--colors-academy-text); border: 1px solid var(--colors-academy-border); border-radius: var(--radii-academy-s); padding: 0.625rem 0.75rem; }
</style>
