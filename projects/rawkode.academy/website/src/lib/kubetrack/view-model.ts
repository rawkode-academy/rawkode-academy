import type { DocNode } from "@rawkodeacademy/rich-text";
import type {
	KubeTrackQuizQuestionData,
	KubeTrackReleaseEntry,
	KubeTrackStage,
} from "./types";

/** Serialisable quiz question handed to the Vue island as props. */
export interface QuizQuestionProps {
	id: string;
	kind: KubeTrackQuizQuestionData["kind"];
	featureSlug?: string | undefined;
	stage?: KubeTrackStage | undefined;
	promptHtml: string;
	explanationHtml: string;
	choices: { id: string; text: string }[];
	answerIds: string[];
}

/** `renderDocument` from live-content, or any renderer with the same shape. */
export type DocumentRenderer = (doc: DocNode) => Promise<{ html: string }>;

const html = async (render: DocumentRenderer, doc: DocNode) =>
	(await render(doc)).html;

/** Build the quiz island's props on the server, rendering rich text to HTML. */
export async function toQuizProps(
	entry: KubeTrackReleaseEntry,
	renderDocument: DocumentRenderer,
): Promise<QuizQuestionProps[]> {
	const features = new Map(
		entry.data.features.map((feature) => [feature.id, feature]),
	);
	return Promise.all(
		entry.data.quizQuestions.map(async (question) => {
			const feature = question.featureId
				? features.get(question.featureId)
				: undefined;
			const [promptHtml, explanationHtml] = await Promise.all([
				html(renderDocument, question.prompt),
				html(renderDocument, question.explanation),
			]);
			return {
				id: question.id,
				kind: question.kind,
				featureSlug: feature?.slug,
				stage: feature?.stage,
				promptHtml,
				explanationHtml,
				choices: question.choices.map(({ id, text }) => ({ id, text })),
				answerIds: [...question.answerIds],
			};
		}),
	);
}
