import { z } from "astro/zod";

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
	message: "Expected an ISO datetime string.",
});

const optionalText = z.preprocess(
	(value) => {
		if (value == null) return undefined;
		if (typeof value !== "string") return value;
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	},
	z.string().min(1).optional(),
);

const optionalIsoDateTime = z.preprocess(
	(value) => {
		if (value == null) return undefined;
		if (typeof value !== "string") return value;
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	},
	isoDateTime.optional(),
);

export const createSessionInputSchema = z
	.object({
		prodConfirmation: z.string().optional(),
		showId: optionalText,
		show: optionalText,
		startsAt: optionalIsoDateTime,
		streamEnvironment: z.enum(["test", "prod"]).default("test"),
		title: optionalText,
		videoId: optionalText,
	})
	.refine((input) => input.videoId || (input.show && input.title), {
		message: "Expected videoId or show and title.",
	});
