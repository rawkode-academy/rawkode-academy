/** Durable Object versions are authoritative and must never move a view backward. */
export function acceptsRoomVersion(currentVersion: number, incomingVersion: number): boolean {
	return Number.isSafeInteger(incomingVersion) && incomingVersion >= currentVersion;
}

/** Equal gameplay versions can still carry newer audience or presence state. */
export function acceptsDeliverySequence(
	currentSequence: number,
	incomingSequence: number,
): boolean {
	return Number.isSafeInteger(incomingSequence) && incomingSequence > currentSequence;
}
