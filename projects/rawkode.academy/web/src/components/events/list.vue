<script setup lang="ts">
import { DateTime } from "luxon";
import type { Database } from "../../database.types";
import { type User, type PostgrestError } from "@supabase/supabase-js";
import { FwbAlert } from "flowbite-vue";
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

</script>

<template>
	<section>
		<div class="gap-8 py-8 px-4 mx-auto lg:gap-16 lg:grid-cols-2 lg:py-16 lg:px-6">
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				<FwbAlert v-if="eventsError" type="danger">
					{{ eventsError.message }}
				</FwbAlert>

				<FwbAlert v-if="rsvpsError" type="danger">
					{{ rsvpsError.message }}
				</FwbAlert>

				<article v-for="event in events" class="py-6">
					<div class="flex justify-between items-center mb-5 text-gray-500">
						<span
							class="bg-primary-100 text-primary-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-primary-200 dark:text-primary-800">
							<svg class="w-4 h-4 text-gray-500 dark:text-white mr-1" aria-hidden="true"
								xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
								<path
									d="M10 .5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19ZM8.374 17.4a7.6 7.6 0 0 1-5.9-7.4c0-.83.137-1.655.406-2.441l.239.019a3.887 3.887 0 0 1 2.082 2.5 4.1 4.1 0 0 0 2.441 2.8c1.148.522 1.389 2.007.732 4.522Zm3.6-8.829a.997.997 0 0 0-.027-.225 5.456 5.456 0 0 0-2.811-3.662c-.832-.527-1.347-.854-1.486-1.89a7.584 7.584 0 0 1 8.364 2.47c-1.387.208-2.14 2.237-2.14 3.307a1.187 1.187 0 0 1-1.9 0Zm1.626 8.053-.671-2.013a1.9 1.9 0 0 1 1.771-1.757l2.032.619a7.553 7.553 0 0 1-3.132 3.151Z" />
							</svg>

							{{ event.channel_info.map((channel_info) => channel_info.channel).join(" | ") }}
						</span>

						<span class="text-sm">
							{{
								event.start_time &&
								DateTime.fromISO(event.start_time).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
							}}
						</span>
					</div>

					<h2 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
						<a :href="`/events/${event.event_id}`">{{ event.name }}</a>
					</h2>

					<p class="mb-5 font-light text-gray-500 dark:text-gray-400">
						{{ event.description }}
					</p>

					<div class="flex justify-between items-stretch">
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
				</article>
			</div>
		</div>
	</section>
</template>
