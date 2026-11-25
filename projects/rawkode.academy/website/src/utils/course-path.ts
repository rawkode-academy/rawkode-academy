export function getCourseModuleSlug(
	courseId: string,
	moduleId: string,
): string {
	const prefix = `${courseId}/`;

	return moduleId.startsWith(prefix) ? moduleId.slice(prefix.length) : moduleId;
}

// Lesson slugs used to start with their order ("01-introduction"). Order now
// lives in sort_order alone, so the old URLs redirect to the slug without it.
export function getUnnumberedLessonSlug(slug: string): string | undefined {
	const match = /^\d+-(.+)$/.exec(slug);
	return match?.[1];
}
