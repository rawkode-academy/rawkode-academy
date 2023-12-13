<script setup lang="ts">
import type { Database } from '../../database.types';

export interface Props {
	event: Database['public']['Tables']['events']['Row']
}

defineProps<Props>()
</script>

<template>
	<div class="w-full grid grid-cols-1 gap-1">
		<h2 class="text-4xl font-extrabold dark:text-white">{{ event.name }}</h2>

		<h6 class="text-lg font-bold dark:text-white">{{ event.start_time }} - {{ event.end_time }}</h6>

		<div class="flex items-center gap-4" v-for="channel_info in event.channel_info">
			<img class="w-10 h-10" :src="`/channel-logos/${channel_info.channel}.svg`">
			<div class="font-medium dark:text-white">
				<div>{{ channel_info.channel }} - here is your link</div>
			</div>
		</div>

		<p v-if="event.description" class="mb-3 text-left rtl:text-right text-gray-500 dark:text-gray-400">{{
			event.description }}</p>

		<div class="flex -space-x-4">
			<img class="w-10 h-10 border-2 border-white rounded-full dark:border-gray-800"
				src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/jese-leos.png" alt="">
			<img class="w-10 h-10 border-2 border-white rounded-full dark:border-gray-800"
				src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/jese-leos.png" alt="">
			<img class="w-10 h-10 border-2 border-white rounded-full dark:border-gray-800"
				src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/jese-leos.png" alt="">
		</div>
	</div>
</template>
