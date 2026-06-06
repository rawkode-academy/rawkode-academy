export function isPublicContentKey(key: string): boolean {
	return !key.startsWith("studio/recordings/");
}
