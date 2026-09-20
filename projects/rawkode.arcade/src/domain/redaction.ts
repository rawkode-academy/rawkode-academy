import type { GameState } from "./engine";
import type { Principal } from "./protocol";
import { redactRuntime } from "./registry";

/** Never send answers, producer notes, or identity data not needed by the recipient. */
export function redactSnapshot(state: GameState, principal: Principal): Omit<GameState, "private"> & { private?: GameState["private"] } {
	const snapshot = structuredClone(state);
	if (snapshot.private.runtime) snapshot.private.runtime = { ...snapshot.private.runtime, state: redactRuntime(snapshot, principal.role) };
	if (principal.role === "host" || principal.role === "producer" || principal.role === "moderator") return snapshot;
	const { private: _private, ...view } = snapshot;
	if (principal.role === "audience") {
		view.players = {};
		for (const team of Object.values(view.teams)) team.memberIds = [];
	}
	return view;
}
