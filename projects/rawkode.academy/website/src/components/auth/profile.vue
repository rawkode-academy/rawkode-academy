<script setup lang="ts">
import type { BetterAuthUser } from "../../lib/auth/better-auth-client";
import { ref, onMounted, onUnmounted } from "vue";
import { actions } from "astro:actions";
import Avatar from "vue-boring-avatars";
import { createLogger } from "@/lib/logger";
import { css, cx } from "../../../styled-system/css";

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

const handleClickOutside = (event: MouseEvent) => {
	if (
		dropdownRef.value &&
		buttonRef.value &&
		!dropdownRef.value.contains(event.target as Node) &&
		!buttonRef.value.contains(event.target as Node)
	) {
		dropdownOpen.value = false;
	}
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
});

onUnmounted(() => {
	document.removeEventListener("click", handleClickOutside);
});

const wrapperStyles = css({
	w: "full",
	display: "flex",
	alignItems: "flex-end",
	justifyContent: "flex-end",
	position: "relative",
});

const buttonStyles = css({
	display: "flex",
	mx: "3",
	fontSize: "sm",
	bg: "gray.800",
	borderRadius: "full",
	md: { mr: "0" },
	_focus: {
		ring: "4px",
		ringColor: { base: "gray.300", _dark: "gray.600" },
	},
});

const avatarImgStyles = css({
	w: "8",
	h: "8",
	borderRadius: "full",
});

const dropdownBase = css({
	position: "absolute",
	right: "0",
	top: "100%",
	zIndex: "50",
	mt: "2",
	w: "56",
	fontSize: "base",
	listStyle: "none",
	bg: { base: "white", _dark: "gray.700" },
	borderRadius: "xl",
	divideY: "1px",
	divideColor: { base: "gray.100", _dark: "gray.600" },
	shadow: "lg",
	transition: "all",
	transitionDuration: "200ms",
});

const dropdownVisibleStyles = css({
	opacity: "1",
	transform: "translateY(0)",
});

const dropdownClosed = css({
	opacity: "0",
	transform: "translateY(-0.5rem)",
	pointerEvents: "none",
});

const dropdownHeaderStyles = css({
	py: "3",
	px: "4",
});

const nameStyles = css({
	display: "block",
	fontSize: "sm",
	fontWeight: "semibold",
	color: { base: "gray.900", _dark: "white" },
});

const emailStyles = css({
	display: "block",
	fontSize: "sm",
	color: { base: "gray.900", _dark: "white" },
	truncate: true,
});

const menuListStyles = css({
	py: "1",
	color: { base: "gray.700", _dark: "gray.300" },
});

const menuItemStyles = css({
	display: "block",
	py: "2",
	px: "4",
	fontSize: "sm",
	_hover: {
		bg: { base: "gray.100", _dark: "gray.600" },
		color: { _dark: "white" },
	},
});

const signOutBtnStyles = cx(menuItemStyles, css({
	w: "full",
	textAlign: "left",
}));
</script>

<template>
	<div :class="wrapperStyles">
		<button
			ref="buttonRef"
			type="button"
			:class="buttonStyles"
			:aria-expanded="dropdownOpen"
			@click="toggleDropdown">
			<span class="sr-only">Open user menu</span>
			<img v-if="user.image" :class="avatarImgStyles" :src="user.image" :alt="`Profile picture for ${user.name || 'user'}`" loading="lazy" />
			<Avatar v-else :class="avatarImgStyles" :name="user.name || ''" variant="pixel" />
		</button>
		<div
			ref="dropdownRef"
			:class="cx(dropdownBase, dropdownOpen ? dropdownVisibleStyles : dropdownClosed)">
			<div :class="dropdownHeaderStyles">
				<span :class="nameStyles">{{ user.name }}</span>
				<span :class="emailStyles">{{ user.email }}</span>
			</div>
			<ul :class="menuListStyles" aria-labelledby="userProfileButton">
				<li>
					<a href="/settings" :class="menuItemStyles">Settings</a>
				</li>
				<li>
					<button @click="signOut" :class="signOutBtnStyles">Sign out</button>
				</li>
			</ul>
		</div>
	</div>
</template>
