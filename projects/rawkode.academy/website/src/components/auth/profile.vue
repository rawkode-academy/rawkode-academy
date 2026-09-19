<script setup lang="ts">
import { Menu } from "@ark-ui/vue/menu";
import { actions } from "astro:actions";
import Avatar from "vue-boring-avatars";
import type { BetterAuthUser } from "../../lib/auth/better-auth-client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");

defineProps<{ user: BetterAuthUser }>();

const signOut = async () => {
	try {
		await actions.auth.signOut();
		if ((window as any).posthog?.reset) (window as any).posthog.reset();
		window.location.href = "/";
	} catch (error) {
		logger.error("Failed to sign out", error);
	}
};
</script>

<template>
	<Menu.Root>
		<Menu.Trigger id="userProfileButton" class="focus-ring flex mx-3 text-sm rounded-full md:mr-0">
			<span class="sr-only">Open user menu</span>
			<img v-if="user.image" class="w-8 h-8 rounded-full" :src="user.image" :alt="`Profile picture for ${user.name || 'user'}`" loading="lazy" />
			<Avatar v-else class="w-8 h-8 rounded-full" :name="user.name || ''" variant="pixel" />
		</Menu.Trigger>

		<Teleport to="body">
			<Menu.Positioner class="z-50">
				<Menu.Content id="userProfileMenu" class="w-56 text-base list-none paper-card divide-y divide-[var(--surface-border)] focus:outline-none">
					<div class="py-3 px-4">
						<span class="block text-sm font-semibold text-primary-content">{{ user.name }}</span>
						<span class="block text-sm text-secondary-content truncate">{{ user.email }}</span>
					</div>
					<div class="py-1 text-secondary-content">
						<Menu.Item value="continue-watching" as-child><a href="/home" class="profile-menu-item">Continue watching</a></Menu.Item>
						<Menu.Item value="settings" as-child><a href="/settings" class="profile-menu-item">Settings</a></Menu.Item>
						<Menu.Item value="sign-out" as-child><button type="button" class="profile-menu-item w-full text-left" @click="signOut">Sign out</button></Menu.Item>
					</div>
				</Menu.Content>
			</Menu.Positioner>
		</Teleport>
	</Menu.Root>
</template>

<style scoped>
.profile-menu-item { display: block; padding: 0.5rem 1rem; font-size: 0.875rem; }
.profile-menu-item:hover,
.profile-menu-item[data-highlighted] { background: var(--surface-card-muted); color: var(--text-primary-content); outline: none; }
</style>
