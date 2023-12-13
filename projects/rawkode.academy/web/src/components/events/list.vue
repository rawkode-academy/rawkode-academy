<script setup lang="ts">
import type { Database } from '../../database.types';
import { type User, type PostgrestError } from '@supabase/supabase-js';

export interface Props {
	events: Database['public']['Tables']['events']['Row'][] | null;
	eventsError: PostgrestError | null;

	rsvps: Database['public']['Tables']['rsvps']['Row'][] | null;
	rsvpsError: PostgrestError | null;

	avatarImages: { [auth_id: string]: string }

	user: User | null;
}

const props = defineProps<Props>()

async function createRsvp(event_id: string) {
	try {
		const response = await fetch(`/api/rsvp/${event_id}`, { method: 'POST', redirect: 'follow' });

		if (response.redirected) {
			window.location.href = response.url;
		}
	} catch (error) {
		console.log(error);
	}
}

async function deleteRsvp(event_id: string) {
	try {
		const response = await fetch(`/api/rsvp/${event_id}`, { method: 'DELETE', redirect: 'follow' });

		if (response.redirected) {
			window.location.href = response.url;
		}
	} catch (error) {
		console.log(error);
	}
}
</script>

<template>
	<div v-if="props.eventsError"
		class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
		<span class="font-medium">Couldn't fetch events:</span>
		{{ props.eventsError.message }}
	</div>

	<div v-if="props.rsvpsError"
		class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
		<span class="font-medium">Couldn't fetch events:</span>
		{{ props.rsvpsError.message }}
	</div>

	<ol class="relative border-s border-gray-200 dark:border-gray-700">
		<li class="mb-10 ms-4" v-for="event in props.events">
			<div
				class="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -start-1.5 border border-white dark:border-gray-900 dark:bg-gray-700" />
			<time class="mb-1 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
				{{ event.start_time }}
			</time>

			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
				<a :href="`/events/${event.event_id}`">{{ event.name }}</a>
			</h3>

			<div class="flex rtl:space-x-reverse">
				<img v-for="channelInfo in event.channel_info"
					class="w-10 h-10 border-2 border-white rounded dark:border-gray-800"
					:src="`/channel-logos/${channelInfo.channel}.svg`" />
			</div>

			<p v-if="event.description" class="text-base font-normal text-gray-500 dark:text-gray-400">
				{{ event.description }}
			</p>

			<a v-if="props.user && props.rsvps?.find((rsvp) => rsvp.event_id === event.event_id && rsvp.auth_id === props.user?.id) === undefined"
				@click="createRsvp(event.event_id)"
				class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-gray-200 focus:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700">
				I'm going
			</a>

			<a v-if="props.rsvps?.find((rsvp) => rsvp.event_id === event.event_id && rsvp.auth_id === props.user?.id) !== undefined"
				@click="deleteRsvp(event.event_id)"
				class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-gray-200 focus:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700">
				I'm not going
			</a>

			<div v-if="props.user" class="flex -space-x-4 rtl:space-x-reverse">
				<img v-for="rsvp in props.rsvps?.filter((rsvp) => rsvp.event_id === event.event_id)"
					class="w-10 h-10 border-2 border-white rounded-full dark:border-gray-800"
					:src="`${avatarImages[rsvp.auth_id] || 'https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/jese-leos.png'}`"
					v-bind:alt="rsvp.auth_id" />
			</div>
		</li>

		<div v-if="props.events?.length === 0"
			class="p-4 mb-4 text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert">
			No events :&#41;
		</div>
	</ol>
</template>
