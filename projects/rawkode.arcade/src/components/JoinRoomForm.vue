<script setup lang="ts">
import { ref } from "vue";
import { css } from "@/../styled-system/css";
import { joinBootstrapKey, requestJoin } from "@/lib/room-bootstrap";
import {
	choice,
	control,
	field,
	fieldLabel,
	notice,
	slug,
	stage,
	text,
} from "@/styles/arcade";

const name = ref("");
const roomCode = ref("");
const teamId = ref("team-red");
const role = ref<"contestant" | "audience">("contestant");
const error = ref("");
const pending = ref(false);

const teams = [
	{ id: "team-red", label: "The Merge Queue" },
	{ id: "team-blue", label: "Cache Invalidators" },
];

const roles = [
	{ id: "contestant", label: "Contestant", hint: "You are on camera." },
	{ id: "audience", label: "Audience", hint: "You play from the crowd." },
] as const;

const form = css({ display: "grid", gap: "4" });
const group = css({ border: "none", padding: "0", margin: "0", display: "grid", gap: "2" });
const legend = css({ padding: "0" });
const options = css({ display: "grid", gap: "2" });
const optionBody = css({ display: "grid", gap: "1", minWidth: "0" });
const radio = css({ accentColor: "action", flexShrink: "0" });
const header = css({
	display: "flex",
	justifyContent: "space-between",
	gap: "3",
	pb: "3",
	mb: "4",
	borderBottomWidth: "hairline",
	borderBottomStyle: "solid",
	borderBottomColor: "rule",
});

async function join() {
	if (!name.value.trim() || !roomCode.value.trim()) {
		error.value = "Enter a display name and room code.";
		return;
	}
	// Invite codes are opaque and case-sensitive: preserve the entered value.
	const code = roomCode.value.trim();
	const desiredRole = role.value === "contestant" ? "player" : "audience";
	pending.value = true;
	error.value = "";
	try {
		const player = { name: name.value.trim(), teamId: teamId.value };
		sessionStorage.setItem("rawkode-arcade-player", JSON.stringify(player));
		const bootstrap = await requestJoin(code, {
			displayName: player.name,
			teamId: player.teamId,
			desiredRole,
		});
		if (bootstrap.role !== desiredRole)
			throw new Error("The room did not return a valid live connection.");
		sessionStorage.setItem(
			joinBootstrapKey,
			JSON.stringify({ ...bootstrap, code }),
		);
		window.location.assign(
			`/${role.value === "contestant" ? "play" : "audience"}/${encodeURIComponent(code)}`,
		);
	} catch (cause) {
		error.value =
			cause instanceof Error ? cause.message : "Unable to join the room.";
		pending.value = false;
	}
}
</script>

<template>
	<div :class="stage({ tone: 'raised', pad: 'comfortable' })" data-stage>
		<div :class="header">
			<span :class="slug({ tone: 'live' })">Live participant</span>
			<span :class="slug()">No account needed</span>
		</div>

		<form :class="form" @submit.prevent="join">
			<div>
				<label :class="fieldLabel" for="join-code">Room code</label>
				<input
					id="join-code"
					v-model="roomCode"
					:class="field({ variant: 'code' })"
					data-testid="room-code-input"
					data-field
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					maxlength="80"
					aria-describedby="join-error"
				/>
			</div>

			<div>
				<label :class="fieldLabel" for="join-name">Display name</label>
				<input
					id="join-name"
					v-model="name"
					:class="field()"
					data-testid="display-name"
					data-field
					autocomplete="nickname"
					maxlength="30"
					aria-describedby="join-error"
				/>
			</div>

			<fieldset :class="group">
				<legend :class="[fieldLabel, legend]">Team</legend>
				<div :class="options">
					<label
						v-for="team in teams"
						:key="team.id"
						:class="choice({ state: teamId === team.id ? 'selected' : 'idle' })"
						:data-testid="`team-choice-${team.id}`"
					>
						<input v-model="teamId" :class="radio" type="radio" name="team" :value="team.id" />
						<span :class="text({ style: 'bodySm' })">{{ team.label }}</span>
					</label>
				</div>
			</fieldset>

			<fieldset :class="group">
				<legend :class="[fieldLabel, legend]">How are you playing?</legend>
				<div :class="options">
					<label
						v-for="option in roles"
						:key="option.id"
						:class="choice({ state: role === option.id ? 'selected' : 'idle' })"
					>
						<input v-model="role" :class="radio" type="radio" name="role" :value="option.id" />
						<span :class="optionBody">
							<span :class="text({ style: 'bodySm' })">{{ option.label }}</span>
							<span :class="text({ style: 'bodySm', tone: 'soft' })">{{ option.hint }}</span>
						</span>
					</label>
				</div>
			</fieldset>

			<p v-if="error" id="join-error" :class="notice({ tone: 'error' })" aria-live="polite">
				{{ error }}
			</p>
			<p v-else id="join-error" hidden></p>

			<button
				:class="control({ tone: 'live', size: 'block' })"
				type="submit"
				data-testid="join-room"
				data-control
				:disabled="pending"
			>
				{{ pending ? "Joining room…" : "Join live room" }}
			</button>
		</form>
	</div>
</template>
