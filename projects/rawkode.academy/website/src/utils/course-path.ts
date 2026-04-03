export function getCourseModuleSlug(
	courseId: string,
	moduleId: string,
): string {
	const prefix = `${courseId}/`;

	return moduleId.startsWith(prefix) ? moduleId.slice(prefix.length) : moduleId;
}
