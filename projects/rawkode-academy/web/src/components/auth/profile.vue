<script setup lang="ts">
import { initFlowbite } from 'flowbite';
import { onMounted } from 'vue';

onMounted(() => {
	initFlowbite();
})

defineProps<{
	user: {
		firstName: string | null
		profilePictureUrl: string | null
		email: string
	}
}>();

</script>

<template>
	<div>
		<button type="button"
			class="flex mx-3 text-sm bg-gray-800 rounded-full md:mr-0 focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600"
			id="userProfileButton" aria-expanded="false" data-dropdown-toggle="userProfileDropdown">
			<span class="sr-only">Open user menu</span>
			<img class="w-8 h-8 rounded-full" :src="user.profilePictureUrl || ''" alt="user photo" />
		</button>
		<div
			class="hidden z-50 my-4 w-56 text-base list-none bg-white rounded divide-y divide-gray-100 shadow dark:bg-gray-700 dark:divide-gray-600 rounded-xl"
			id="userProfileDropdown">
			<div class="py-3 px-4">
				<span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ user.firstName }}</span>
				<span class="block text-sm text-gray-900 truncate dark:text-white">{{ user.email }}</span>
			</div>
			<ul class="py-1 text-gray-700 dark:text-gray-300" aria-labelledby="dropdown">
				<li>
					<a href="#"
						class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-400 dark:hover:text-white">My
						Profile (Coming Soon)</a>
				</li>
				<li>
					<a href="#"
						class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-400 dark:hover:text-white">Account
						Settings (Coming Soon)</a>
				</li>
			</ul>
			<ul class="py-1 text-gray-700 dark:text-gray-300" aria-labelledby="dropdown">
				<li>
					<a href="/auth/logout"
						class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">Sign
						out</a>
				</li>
			</ul>
		</div>
	</div>
</template>
