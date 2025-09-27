import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import { type PresetItem, RealtimeKitClient } from "@/lib/realtime-kit/client";

export const GET: APIRoute = async ({ locals, request }) => {
	const authError = requireDirectorRole(locals);
	if (authError) return authError;

	const url = new URL(request.url);
	const dryRun =
		url.searchParams.get("dry_run") === "1" ||
		url.searchParams.get("dryRun") === "true";
	const cutoffMs = Number.parseInt(
		url.searchParams.get("cutoff_minutes") || "120",
		10,
	);
	const cutoff = new Date(Date.now() - cutoffMs * 60_000);

	const client = new RealtimeKitClient();

	// Build a preset lookup to identify recorder-only attendees
	const presetMap = new Map<string, PresetItem>();
	try {
		const presets = await client.getPresets({ per_page: 100 });
		for (const p of presets.data || []) presetMap.set(p.name, p);
	} catch (_e) {
		// Non-fatal: fallback to name heuristics
	}

	const isRecorderPreset = (name?: string): boolean => {
		if (!name) return false;
		const preset = presetMap.get(name);
		if (preset?.permissions?.is_recorder) return true;
		if (
			preset?.permissions?.recorder_type &&
			preset.permissions.recorder_type !== "NONE"
		)
			return true;
		// Heuristic fallback
		const n = name.toLowerCase();
		return (
			n.includes("recorder") ||
			n.includes("recording") ||
			n.includes("livestream")
		);
	};

	// Paginate meetings before cutoff; we also filter by updated_at to be safe
	const candidates: Array<{ id: string; title?: string; updated_at?: string }> =
		[];
	let page = 1;
	const per_page = 50;
	const cutoffIso = cutoff.toISOString();

	// listMeetings supports start_time/end_time; we use end_time to reduce search window
	// and then filter by updated_at as an extra guard.
	while (true) {
		const res = await client.listMeetings({
			page_no: page,
			per_page,
			end_time: cutoffIso,
		});
		const items = res.data || [];
		for (const m of items) {
			const last = m.updated_at || m.created_at;
			if (last && new Date(last) <= cutoff) {
				candidates.push({ id: m.id, title: m.title, updated_at: m.updated_at });
			}
		}
		if (!res.paging || items.length < per_page) break;
		page += 1;
		if (page > 20) break; // hard stop to avoid excessive scanning
	}

	const actions: Array<{ meetingId: string; reason: string }> = [];
	const errors: Array<{ meetingId: string; error: string }> = [];

	for (const m of candidates) {
		try {
			// Determine participant situation
			let participantCount = 0;
			let onlyPresetName: string | undefined;

			try {
				const active = await client.getActiveSession(m.id);
				if (active?.id) {
					const parts = await client.getSessionParticipants(active.id, {
						per_page: 50,
					});
					participantCount = (parts.data || []).length;
					if (participantCount === 1) {
						onlyPresetName = parts.data[0]?.preset_name;
					}
				}
			} catch (_e) {
				// No active session: treat as zero participants
				participantCount = 0;
			}

			const okToClear =
				participantCount === 0 ||
				(participantCount === 1 && isRecorderPreset(onlyPresetName));

			if (!okToClear) continue;

			if (dryRun) {
				actions.push({
					meetingId: m.id,
					reason: participantCount === 0 ? "no_participants" : "only_recorder",
				});
			} else {
				await client.stopMeeting(m.id);
				actions.push({
					meetingId: m.id,
					reason: participantCount === 0 ? "no_participants" : "only_recorder",
				});
			}
		} catch (e) {
			errors.push({
				meetingId: m.id,
				error: e instanceof Error ? e.message : String(e),
			});
		}
	}

	return new Response(
		JSON.stringify({
			cutoff: cutoffIso,
			dryRun,
			candidates: candidates.length,
			cleared: actions.length,
			actions,
			errors,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
