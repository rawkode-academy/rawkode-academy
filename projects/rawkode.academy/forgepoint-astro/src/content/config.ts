import { defineCollection, z, reference } from "astro:content";

const personas = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		goals: z.array(z.string()),
		painPoints: z.array(z.string()),
		context: z.string(),
		role: z.string().optional(),
		experience: z
			.enum(["beginner", "intermediate", "expert", "varied"])
			.optional(),
	}),
});

const activities = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		order: z.number().int().min(1),
		outcome: z.string(),
		personas: z.array(reference("personas")),
		metrics: z
			.array(
				z.object({
					name: z.string(),
					target: z.string(),
				}),
			)
			.optional(),
	}),
});

const stories = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		personaId: reference("personas"),
		iWant: z.string(),
		soThat: z.string(),
		acceptanceCriteria: z.array(z.string()),
		priority: z.enum(["must", "should", "could", "wont"]),
		size: z.enum(["XS", "S", "M", "L", "XL"]).optional(),
		activityId: reference("activities"),
		featureId: reference("features").optional(),
		dependencies: z
			.array(
				z.object({
					id: reference("stories"),
					type: z.enum(["blocks", "requires", "relates-to"]),
					duration: z.string().optional(),
				}),
			)
			.optional(),
		attachments: z
			.array(
				z.object({
					type: z.enum(["bdd-scenario", "mockup", "diagram", "document"]),
					title: z.string().optional(),
					url: z.string().optional(),
					given: z.array(z.string()).optional(),
					when: z.array(z.string()).optional(),
					then_: z.array(z.string()).optional(),
				}),
			)
			.optional(),
	}),
});

const features = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		enhancement: z.string(),
		priority: z.enum(["must", "should", "could", "wont"]),
		size: z.enum(["XS", "S", "M", "L", "XL"]).optional(),
		dependencies: z
			.array(
				z.object({
					id: reference("features"),
					type: z.enum(["blocks", "requires", "relates-to"]),
					duration: z.string().optional(),
				}),
			)
			.optional(),
	}),
});

const prds = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		status: z.enum(["proposed", "accepted", "completed", "deprecated"]),
		owner: z.string(),
		stakeholders: z.array(z.string()).optional(),
		problem: z.string(),
		solution: z.string(),
		requirements: z.array(z.string()),
		metrics: z
			.array(
				z.object({
					name: z.string(),
					target: z.string(),
				}),
			)
			.optional(),
		createdAt: z.date().optional(),
		updatedAt: z.date().optional(),
	}),
});

const adrs = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		status: z.enum([
			"proposed",
			"accepted",
			"completed",
			"deprecated",
			"superseded",
		]),
		context: z.string(),
		decision: z.string(),
		consequences: z.string(),
		date: z.date(),
		supersededBy: reference("adrs").optional(),
		relatedDecisions: z.array(reference("adrs")).optional(),
	}),
});

const actions = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		personaId: reference("personas"),
		activityId: reference("activities"),
		type: z.enum(["click", "input", "navigate", "view", "interact"]),
		outcome: z.string(),
		storyId: reference("stories").optional(),
		sequence: z.number().int().min(1).optional(),
		preconditions: z.array(z.string()).optional(),
		postconditions: z.array(z.string()).optional(),
	}),
});

export const collections = {
	personas,
	activities,
	stories,
	features,
	prds,
	adrs,
	actions,
};
