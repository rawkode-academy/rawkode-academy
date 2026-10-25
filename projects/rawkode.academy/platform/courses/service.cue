package cuenv

import gen "github.com/rawkode-academy/rawkode-academy/projects/rawkode.academy/codegen"

// Courses: the Course, CourseModule and LearningPath entities. Authors and
// technologies are references to the people and technologies services.
_service: gen.#PlatformService & {
	serviceName: "courses"
	// Rich-text bodies are TipTap documents; the read model uses its types.
	additionalDependencies: {
		"@rawkodeacademy/rich-text": "workspace:*"
	}
	additionalDevDependencies: {
		miniflare: "4.20260529.0"
	}
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "platform-courses"
			databaseId:   "9e0bbf1f-9d58-4c68-81bc-7ba67973a5e9"
		}]
	}
}

codegen: _service.codegen
