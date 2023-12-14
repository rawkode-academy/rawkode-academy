<script setup lang="ts">
import { DateTime } from "luxon";
import type { Database } from "../../database.types";
import { type User, type PostgrestError } from "@supabase/supabase-js";

export interface Props {
	events: Database["public"]["Tables"]["events"]["Row"][] | null;
	eventsError: PostgrestError | null;

	rsvps: Database["public"]["Tables"]["rsvps"]["Row"][] | null;
	rsvpsError: PostgrestError | null;

	avatarImages: { [auth_id: string]: string };

	user: User | null;
}

defineProps<Props>();

async function createRsvp(event_id: string) {
	try {
		const response = await fetch(`/api/rsvp/${event_id}`, {
			method: "POST",
			redirect: "follow",
		});

		if (response.redirected) {
			window.location.href = response.url;
		}
	} catch (error) {
		console.log(error);
	}
}

async function deleteRsvp(event_id: string) {
	try {
		const response = await fetch(`/api/rsvp/${event_id}`, {
			method: "DELETE",
			redirect: "follow",
		});

		if (response.redirected) {
			window.location.href = response.url;
		}
	} catch (error) {
		console.log(error);
	}
}
</script>

<template>
	<section>
		<div class="gap-8 py-8 px-4 mx-auto lg:gap-16 lg:grid-cols-2 lg:py-16 lg:px-6">
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				<div v-if="eventsError"
					class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
					<span class="font-medium">Couldn't fetch events:</span>
					{{ eventsError.message }}
				</div>

				<div v-if="rsvpsError"
					class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
					<span class="font-medium">Couldn't fetch events:</span>
					{{ rsvpsError.message }}
				</div>

				<article v-for="event in events" class="py-6">
					<div class="flex justify-between items-center mb-5 text-gray-500">
						<span
							class="bg-primary-100 text-primary-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-primary-200 dark:text-primary-800">
							{{ event.channel_info.map((channel_info) => channel_info.channel).join(" | ") }}
						</span>

						<span class="text-sm">{{ event.start_time &&
							DateTime.fromISO(event.start_time).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS) }}</span>
					</div>
					<h2 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
						<a :href="`/events/${event.event_id}`">{{ event.name }}</a>
					</h2>

					<p class="mb-5 font-light text-gray-500 dark:text-gray-400">
						{{ event.description }}
					</p>

					<div class="flex justify-between items-stretch">
						<div class="flex justify-between">
							<a v-if="user &&
								rsvps?.find(
									(rsvp) =>
										rsvp.event_id === event.event_id &&
										rsvp.auth_id === user?.id
								) === undefined
								" @click="createRsvp(event.event_id)"
								class="hover:cursor-pointer inline-flex items-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-gray-200 focus:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700">
								I'm going
							</a>

							<a v-if="rsvps?.find(
								(rsvp) =>
									rsvp.event_id === event.event_id &&
									rsvp.auth_id === user?.id
							) !== undefined
								" @click="deleteRsvp(event.event_id)"
								class="hover:cursor-pointer inline-flex items-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-gray-200 focus:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700">
								I'm not going
							</a>

							<div v-if="user" class="flex -space-x-4 rtl:space-x-reverse">
								<img v-for="rsvp in rsvps?.filter(
									(rsvp) => rsvp.event_id === event.event_id
								)" class="w-10 h-10 border-2 border-white rounded-full dark:border-gray-800" :src="`${avatarImages[rsvp.auth_id] ||
	'https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/jese-leos.png'
	}`" v-bind:alt="rsvp.auth_id" />
							</div>
						</div>
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
				</article>
			</div>
		</div>
	</section>
</template>
