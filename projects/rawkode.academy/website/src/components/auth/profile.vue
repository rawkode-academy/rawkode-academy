<script setup lang="ts">
import type { BetterAuthUser } from "../../lib/auth/better-auth-client";
import { ref, onMounted, onUnmounted } from "vue";
import { actions } from "astro:actions";
import Avatar from "vue-boring-avatars";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");

const dropdownOpen = ref(false);
const dropdownRef = ref<HTMLDivElement>();
const buttonRef = ref<HTMLButtonElement>();

defineProps<{
	user: BetterAuthUser;
}>();

const toggleDropdown = () => {
	dropdownOpen.value = !dropdownOpen.value;
};

const closeDropdown = (restoreFocus = false) => {
	if (!dropdownOpen.value) return;
	dropdownOpen.value = false;
	if (restoreFocus) buttonRef.value?.focus();
};

const handleClickOutside = (event: MouseEvent) => {
	if (
		dropdownRef.value &&
		buttonRef.value &&
		!dropdownRef.value.contains(event.target as Node) &&
		!buttonRef.value.contains(event.target as Node)
	) {
		closeDropdown();
	}
};

const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") closeDropdown(true);
};

const signOut = async () => {
	try {
		await actions.auth.signOut();
		// Reset PostHog to unlink browser session from user
		// Prevents next user's events being attributed to this user
		if ((window as any).posthog?.reset) {
			(window as any).posthog.reset();
		}
		window.location.href = "/";
	} catch (error) {
		logger.error("Failed to sign out", error);
	}
};

onMounted(() => {
	document.addEventListener("click", handleClickOutside);
	document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener("click", handleClickOutside);
	document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
	<div class="w-full flex items-end justify-end relative">
		<button
			ref="buttonRef"
			id="userProfileButton"
			type="button"
			class="focus-ring flex mx-3 text-sm rounded-full md:mr-0"
			aria-haspopup="true"
			aria-controls="userProfileMenu"
			:aria-expanded="dropdownOpen"
			@click="toggleDropdown">
			<span class="sr-only">Open user menu</span>
			<img v-if="user.image" class="w-8 h-8 rounded-full" :src="user.image" :alt="`Profile picture for ${user.name || 'user'}`" loading="lazy" />
			<Avatar v-else class="w-8 h-8 rounded-full" :name="user.name || ''" variant="pixel" />
		</button>
		<div
			ref="dropdownRef"
			id="userProfileMenu"
			:class="[
				'absolute right-0 top-full z-50 mt-2 w-56 text-base list-none paper-card divide-y divide-[var(--surface-border)] transition-smooth',
				dropdownOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
			]">
			<div class="py-3 px-4">
				<span class="block text-sm font-semibold text-primary-content">{{ user.name }}</span>
				<span class="block text-sm text-secondary-content truncate">{{ user.email }}</span>
			</div>
			<ul class="py-1 text-secondary-content" aria-labelledby="userProfileButton">
				<li>
					<a href="/home"
						class="block py-2 px-4 text-sm hover:bg-[var(--surface-card-muted)] hover:text-primary-content">Continue watching</a>
				</li>
				<li>
					<a href="/settings"
						class="block py-2 px-4 text-sm hover:bg-[var(--surface-card-muted)] hover:text-primary-content">Settings</a>
				</li>
				<li>
					<button @click="signOut"
						class="w-full text-left block py-2 px-4 text-sm hover:bg-[var(--surface-card-muted)] hover:text-primary-content">Sign
						out</button>
				</li>
			</ul>
		</div>
	</div>
</template>
