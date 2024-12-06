<script setup lang="ts">
import { initFlowbite } from 'flowbite';
import type { OidcStandardClaims } from 'oidc-client-ts';
import { onMounted } from 'vue';
import Avatar from "vue-boring-avatars";

onMounted(() => {
	initFlowbite();
})

defineProps<{
	user: OidcStandardClaims;
}>();

</script>

<template>
	<div>
		<button type="button"
			class="flex mx-3 text-sm bg-gray-800 rounded-full md:mr-0 focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600"
			id="userProfileButton" aria-expanded="false" data-dropdown-toggle="userProfileDropdown">
			<span class="sr-only">Open user menu</span>
			<img v-if="user.picture" class="w-8 h-8 rounded-full" :src="user.picture" alt="user photo" />
			<Avatar v-else class="w-8 h-8 rounded-full" :name="user.name || ''" variant="pixel" />
		</button>
		<div
			class="hidden z-50 my-4 w-56 text-base list-none bg-white rounded divide-y divide-gray-100 shadow dark:bg-gray-700 dark:divide-gray-600 rounded-xl"
			id="userProfileDropdown">
			<div class="py-3 px-4">
				<span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ user.name }}</span>
				<span class="block text-sm text-gray-900 truncate dark:text-white">{{ user.email }}</span>
			</div>
			<ul class="py-1 text-gray-700 dark:text-gray-300" aria-labelledby="dropdown">
				<li>
					<a target="_blank" href="https://zitadel.rawkode.academy"
						class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">My
						Profile</a>
				</li>
			</ul>
			<ul class="py-1 text-gray-700 dark:text-gray-300" aria-labelledby="dropdown">
				<li>
					<a href="/api/auth/sign-out"
						class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">Sign
						out</a>
				</li>
			</ul>
		</div>
	</div>
</template>
