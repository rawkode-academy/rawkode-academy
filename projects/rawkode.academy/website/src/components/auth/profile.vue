<script setup lang="ts">
import type { OidcStandardClaims } from "oidc-client-ts";
import { ref, onMounted, onUnmounted } from "vue";
import Avatar from "vue-boring-avatars";

const dropdownOpen = ref(false);
const dropdownRef = ref<HTMLDivElement>();
const buttonRef = ref<HTMLButtonElement>();

defineProps<{
	user: OidcStandardClaims;
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

onMounted(() => {
	document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
	document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
	<div class="w-full flex items-end justify-end relative">
		<button 
			ref="buttonRef"
			type="button"
			class="flex mx-3 text-sm bg-gray-800 rounded-full md:mr-0 focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600"
			:aria-expanded="dropdownOpen"
			@click="toggleDropdown">
			<span class="sr-only">Open user menu</span>
			<img v-if="user.picture" class="w-8 h-8 rounded-full" :src="user.picture" :alt="`Profile picture for ${user.name || 'user'}`" loading="lazy" />
			<Avatar v-else class="w-8 h-8 rounded-full" :name="user.name || ''" variant="pixel" />
		</button>
		<div
			ref="dropdownRef"
			:class="[
				'absolute right-0 top-full z-50 mt-2 w-56 text-base list-none bg-white rounded divide-y divide-gray-100 shadow dark:bg-gray-700 dark:divide-gray-600 rounded-xl transition-all duration-200',
				dropdownOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
			]">
			<div class="py-3 px-4">
				<span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ user.name }}</span>
				<span class="block text-sm text-gray-900 truncate dark:text-white">{{ user.email }}</span>
			</div>
			<ul class="py-1 text-gray-700 dark:text-gray-300" aria-labelledby="userProfileButton">
				<li>
					<a target="_blank" href="https://zitadel.rawkode.academy"
						class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">My
						Profile</a>
				</li>
			</ul>
			<ul class="py-1 text-gray-700 dark:text-gray-300" aria-labelledby="userProfileButton">
				<li>
					<a href="/api/auth/sign-out"
						class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">Sign
						out</a>
				</li>
			</ul>
		</div>
	</div>
</template>