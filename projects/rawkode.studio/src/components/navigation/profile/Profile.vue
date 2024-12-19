<script setup lang="ts">
import type { OidcStandardClaimsWithRoles } from "@/lib/security";
import { initFlowbite } from "flowbite";
import { onMounted } from "vue";

onMounted(() => {
	initFlowbite();
});

defineProps<{ user: OidcStandardClaimsWithRoles | undefined }>();
</script>

<template>
	<button
		v-if="user"
		type="button"
		class="flex mx-3 text-sm bg-gray-800 rounded-full md:mr-0 focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600"
		id="user-menu-button"
		aria-expanded="false"
		data-dropdown-toggle="dropdown"
	>
		<span class="sr-only">Open user menu</span>
		<img
			class="w-8 h-8 rounded-full"
			src="https://flowbite.com/docs/images/people/profile-picture-5.jpg"
			alt="user photo"
		/>
	</button>

	<div
		v-if="user"
		class="hidden z-50 my-4 w-56 text-base list-none bg-white rounded divide-y divide-gray-100 shadow dark:bg-gray-700 dark:divide-gray-600"
		id="dropdown"
	>
		<div class="py-3 px-4">
			<span class="block text-sm font-semibold text-gray-900 dark:text-white">
				{{ user.name }}
			</span>

			<span
				class="block text-sm font-light text-gray-500 truncate dark:text-gray-400"
			>
				{{ user.email }}
			</span>
		</div>

		<ul
			class="py-1 font-light text-gray-500 dark:text-gray-400"
			aria-labelledby="dropdown"
		>
			<li>
				<a
					href="/profile"
					class="block py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-400 dark:hover:text-white"
				>
					Profile
				</a>
			</li>
		</ul>
	</div>

	<a
		v-if="user"
		href="/api/auth/logout"
		class="text-primary-600 dark:text-primary-500 ml-1 lg:ml-3 hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-3 lg:px-5 py-2 lg:py-2.5 dark:hover:bg-gray-700 focus:outline-none dark:focus:ring-gray-800"
	>
		Logout
	</a>
	<a
		v-if="!user"
		href="/api/auth/login"
		class="text-primary-600 dark:text-primary-500 ml-1 lg:ml-3 hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-3 lg:px-5 py-2 lg:py-2.5 dark:hover:bg-gray-700 focus:outline-none dark:focus:ring-gray-800"
	>
		Login
	</a>
</template>
