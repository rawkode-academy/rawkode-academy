export type CourseLessons = { id: string; modules: { slug: string; video: { id: string } | null }[] }[];

/** Where a video lives on the site: a course-only video has no watch page, only its lesson. */
export const videoLinks = (courses: CourseLessons | undefined) => {
	const lessons = new Map<string, string>();
	for (const course of courses ?? []) {
		for (const lesson of course.modules) {
			if (lesson.video?.id && !lessons.has(lesson.video.id)) {
				lessons.set(lesson.video.id, `https://rawkode.academy/courses/${course.id}/${lesson.slug}`);
			}
		}
	}
	return (video: { id: string; slug: string }) => lessons.get(video.id) ?? `https://rawkode.academy/watch/${video.slug}`;
};
