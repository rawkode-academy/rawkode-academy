<script setup lang="ts">
import type { User } from '@supabase/supabase-js';
import type { Database } from '../../database.types';
import { FwbAvatarStack, FwbAvatar, FwbButton } from "flowbite-vue";

export interface Props {
	eventId: string

	rsvps: Database["public"]["Tables"]["rsvps"]["Row"][] | null;

	avatarImages: { [auth_id: string]: string };

	user: User | null;

	horizontal?: boolean
}

const props = defineProps<Props>()

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

type EventRsvps = {
	[eventId: string]: [string[], number]
}

const rsvpsWithCount = props.rsvps?.reduce<EventRsvps>((acc, elem) => {
	var eventIdElement = acc[elem.event_id];

	if (!eventIdElement) {
		acc[elem.event_id] = [[elem.auth_id], 1]
	} else {
		// show the first 10 auth_ids and count all
		if (eventIdElement[0].length < 10) {
			eventIdElement[0].push(elem.auth_id)
			eventIdElement[1]++;
		}
	}
	return acc;
}, {})

function isGoing(eventId: string, user: User | null, rsvps: Database['public']['Tables']['rsvps']['Row'][] | null): boolean {
	return rsvps?.find(rsvp => rsvp.event_id === eventId && rsvp.auth_id === user?.id) !== undefined
}

</script>

<template>
	<div v-if="user && !horizontal" class="flex flex-col gap-1 items-end">
		<FwbAvatarStack v-if="rsvpsWithCount && rsvpsWithCount[eventId]">
			<FwbAvatar v-for="authId in rsvpsWithCount[eventId]?.[0]" :img="`${avatarImages[authId]}`" rounded />
		</FwbAvatarStack>

		<p class="text-xs">{{ (rsvpsWithCount && rsvpsWithCount[eventId]?.[1] || 0) }} People</p>
		<FwbButton color="light" v-if="!isGoing(eventId, user, rsvps)" @click="createRsvp(eventId)" class="w-full">
			I'm going
		</FwbButton>

		<FwbButton v-if="isGoing(eventId, user, rsvps)" @click="deleteRsvp(eventId)" class="w-full">
			I'm not going
		</FwbButton>

	</div>

	<div v-if="user && horizontal" class="flex flex-row gap-1 items-center">
		<FwbButton v-if="!isGoing(eventId, user, rsvps)" @click="createRsvp(eventId)">
			I'm going
		</FwbButton>

		<FwbButton v-if="isGoing(eventId, user, rsvps)" @click="deleteRsvp(eventId)">
			I'm not going
		</FwbButton>

		<FwbAvatarStack v-if="rsvpsWithCount && rsvpsWithCount[eventId]">
			<FwbAvatar v-for="authId in rsvpsWithCount[eventId]?.[0]" :img="`${avatarImages[authId]}`" rounded />
		</FwbAvatarStack>

		<p class="text-xs">{{ (rsvpsWithCount && rsvpsWithCount[eventId]?.[1] || 0) }} People</p>
	</div>
</template>
