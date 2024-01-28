<script setup lang="ts">
import type { User } from '@supabase/supabase-js';
import type { Database } from '../../database.types';
import Rsvp from "./rsvp.vue";
import { DateTime } from 'luxon';

export interface Props {
	event: Database['public']['Tables']['events']['Row']
	rsvps: Database['public']['Tables']['rsvps']['Row'][]
	user: User | null
	avatarImages: { [authId: string]: string };
}

defineProps<Props>()

function renderInfo(channelInfo: any): string {
	if (channelInfo && channelInfo.info && channelInfo.info.url) {
		return channelInfo.info.url
	}

	return channelInfo.channel
}
</script>

<template>
	<h1 class="text-5xl font-extrabold dark:text-white mb-10 text-center">{{ event.name }}</h1>

	<div class="flex flex-col gap-2">
		<div v-if="event.start_time && event.end_time">
			{{ DateTime.fromISO(event.start_time).toFormat('dd MMM hh:mm') }}
			-
			{{ DateTime.fromISO(event.end_time).toFormat('dd MMM hh:mm') }}
		</div>

		<div v-if="event.channel_info.filter(c => c.channel).length > 0">
			<ul class="max-w-md space-y-1 text-gray-500 list-inside dark:text-gray-400">
				<li v-for="channelInfo in event.channel_info" class="flex items-center">
					<img :src="`/channel-logos/${channelInfo.channel}.svg`" class="w-4 h-4 me-2" />

					<a class="text-sm" :href="renderInfo(channelInfo)" target="_blank">{{ renderInfo(channelInfo) }}</a>
				</li>
			</ul>
		</div>

		<p v-if="event.description" class="text-justify text-gray-500 dark:text-gray-400">
			{{ event.description }}
		</p>

		<Rsvp :event-id="event.event_id" :rsvps="rsvps" :user="user" :avatar-images="avatarImages" horizontal />
	</div>
</template>
