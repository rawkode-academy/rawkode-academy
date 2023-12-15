<script setup lang="ts">
import type { User } from '@supabase/supabase-js';
import type { Database } from '../../database.types';
import Rsvp from "./rsvp.vue";
import { DateTime, Interval } from 'luxon';
import { FwbHeading } from 'flowbite-vue';

export interface Props {
	event: Database['public']['Tables']['events']['Row']
	rsvps: Database['public']['Tables']['rsvps']['Row'][]
	user: User | null
	avatarImages: { [authId: string]: string };
}

defineProps<Props>()

function eventDuration(event: Database['public']['Tables']['events']['Row']): string | null {
	if (event.start_time && event.end_time) {
		const startTime = DateTime.fromISO(event.start_time)
		const endTime = DateTime.fromISO(event.end_time)

		return Interval
			.fromDateTimes(startTime, endTime)
			.toDuration(['hours', 'minutes'])
			.toHuman({ unitDisplay: 'short' })
	}

	return null;
}
</script>

<template>
	<div class="grid grid-cols-1 pt-2 gap-2">
		<div class="flex">
			<div class="w-3/4 max-h-[400px]">
				<img src="https://baconmockup.com/1000/1000/" class="w-full h-full object-cover" />
			</div>

			<div class="w-1/4 p-2 flex flex-col justify-between items-stretch bg-gray-50">
				<div class="flex flex-col gap-1">
					<FwbHeading>{{ event.name }}</FwbHeading>

					<p class="text-base">
						Date: {{
							event.start_time &&
							DateTime.fromISO(event.start_time).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
						}}
					</p>

					<p class="text-base">
						Duration: {{ eventDuration(event) }}
					</p>
				</div>

				<Rsvp :event-id="event.event_id" :rsvps="rsvps" :user="user" :avatar-images="avatarImages" />
			</div>
		</div>

		<div class="p-4 flex flex-col gap-y-2">
			<h6 class="text-lg font-bold dark:text-white">Location</h6>

			<ul class="max-w-md space-y-1 text-gray-500 list-inside dark:text-gray-400">
				<li class="flex items-center gap-x-1" v-for="channelInfo in event.channel_info">
					<img :src="`/channel-logos/${channelInfo.channel}.svg`" class="w-4 h-4" />
					{{ channelInfo.channel }}
					{{ JSON.stringify(channelInfo.info) }}
				</li>
			</ul>

			<h6 class="text-lg font-bold dark:text-white">Description</h6>

			{{ event.description }}
		</div>
	</div>
</template>
