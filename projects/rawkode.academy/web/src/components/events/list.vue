<script setup lang="ts">
import { DateTime } from "luxon";
import type { Database } from "../../database.types";
import { type User, type PostgrestError } from "@supabase/supabase-js";
import Rsvp from './rsvp.vue';

export interface Props {
	events: Database["public"]["Tables"]["events"]["Row"][] | null;
	eventsError: PostgrestError | null;

	rsvps: Database["public"]["Tables"]["rsvps"]["Row"][] | null;
	rsvpsError: PostgrestError | null;

	avatarImages: { [authId: string]: string };

	user: User | null;
}

defineProps<Props>();

function renderInfo(channelInfo: any): string {
	if (channelInfo && channelInfo.info && channelInfo.info.url) {
		return channelInfo.info.url
	}

	return channelInfo.channel
}
</script>

<template>
	<h1 class="text-5xl font-extrabold dark:text-white mb-10 text-center">Events</h1>

	<div class="flex flex-col gap-8">
		<div v-if="eventsError" class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400"
			role="alert">
			{{ eventsError }}
		</div>

		<div v-if="rsvpsError" class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400"
			role="alert">
			{{ rsvpsError }}
		</div>

		<div v-if="events?.length === 0" class="text-center">
			No events yet :/
		</div>

		<div v-for="event in events">
			<div class="flex flex-row gap-2">
				<div class="w-40 h-auto p-2 flex flex-col items-center justify-center bg-white">
					<h6 v-if="event.start_time && DateTime.fromISO(event.start_time).hasSame(DateTime.local(), 'day')"
						class="text-xl font-bold dark:text-white">
						TODAY
					</h6>
					<h6 v-if="event.start_time && !DateTime.fromISO(event.start_time).hasSame(DateTime.local(), 'day')"
						class="text-2xl font-bold dark:text-white">
						{{ DateTime.fromISO(event.start_time).toFormat('dd MMM') }}
					</h6>
					<h6 v-if="event.start_time && !DateTime.fromISO(event.start_time).hasSame(DateTime.local(), 'day')"
						class="text-xl font-bold dark:text-white">
						{{ DateTime.fromISO(event.start_time).toFormat('hh:mm') }}
					</h6>
				</div>

				<div class="w-full h-auto flex flex-col justify-between gap-2">
					<a :href="`/events/${event.event_id}`">
						<h4 class="text-2xl font-bold dark:text-white">{{ event.name }}</h4>
					</a>

					<!-- check whether the channel is set or not -->
					<div v-if="event.channel_info.filter(c => c.channel).length > 0">
						<ul class="max-w-md space-y-1 text-gray-500 list-inside dark:text-gray-400">
							<li v-for="channelInfo in event.channel_info" class="flex items-center">
								<img :src="`/channel-logos/${channelInfo.channel}.svg`" class="w-4 h-4 me-2" />

								<a class="text-sm" :href="renderInfo(channelInfo)" target="_blank">{{ renderInfo(channelInfo) }}</a>
							</li>
						</ul>
					</div>

					<p v-if="event.description" class="text-gray-500 dark:text-gray-400">
						{{ event.description }}
					</p>

					<div class="flex flex-row justify-between">
						<Rsvp :event-id="event.event_id" :rsvps="rsvps" :user="user" :avatar-images="avatarImages" horizontal />

						<a :href="`/events/${event.event_id}`"
							class="inline-flex items-center font-medium text-primary-600 hover:underline dark:text-primary-500">
							Read more
							<svg class="ml-2 w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
									clip-rule="evenodd"></path>
							</svg>
						</a>
					</div>
				</div>
			</div>

			<hr class="h-px mt-8 bg-gray-200 border-0 dark:bg-gray-700">
		</div>
	</div>
</template>
