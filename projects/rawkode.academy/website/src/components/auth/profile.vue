<script setup lang="ts">
import { Menu } from "@ark-ui/vue/menu";
import { actions } from "astro:actions";
import Avatar from "vue-boring-avatars";
import { academyShell } from "@rawkodeacademy/design-system";
import type { BetterAuthUser } from "../../lib/auth/better-auth-client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");
const shell = academyShell();

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
		<Menu.Trigger id="userProfileButton" :class="shell.profileTrigger">
			<span class="sr-only">Open user menu</span>
			<img v-if="user.image" :class="shell.profileAvatar" :src="user.image" :alt="`Profile picture for ${user.name || 'user'}`" loading="lazy" />
			<Avatar v-else :class="shell.profileAvatar" :name="user.name || ''" variant="pixel" />
		</Menu.Trigger>

		<Teleport to="body">
			<Menu.Positioner :class="shell.profilePositioner">
				<Menu.Content id="userProfileMenu" :class="shell.profileMenu">
					<div :class="shell.profileIdentity">
						<span :class="shell.profileName">{{ user.name }}</span>
						<span :class="shell.profileEmail">{{ user.email }}</span>
					</div>
					<div :class="shell.profileMenuItems">
						<Menu.Item value="continue-watching" as-child><a href="/home" :class="shell.profileMenuItem">Continue watching</a></Menu.Item>
						<Menu.Item value="settings" as-child><a href="/settings" :class="shell.profileMenuItem">Settings</a></Menu.Item>
						<Menu.Item value="sign-out" as-child><button type="button" :class="[shell.profileMenuItem, shell.profileMenuButton]" @click="signOut">Sign out</button></Menu.Item>
					</div>
				</Menu.Content>
			</Menu.Positioner>
		</Teleport>
	</Menu.Root>
</template>
