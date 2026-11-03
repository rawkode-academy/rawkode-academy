import type { ThumbnailWorkflowParams } from "./contracts";

export interface Env {
	AI: Ai;
	/** Service binding to the GraphQL gateway worker "platform-api-gateway". */
	API: Fetcher;
	BROWSER: BrowserRun;
	CONTENT_BUCKET: R2Bucket;
	GENERATE_VIDEO_THUMBNAIL: Workflow<ThumbnailWorkflowParams>;
}
