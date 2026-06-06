import type { ThumbnailWorkflowParams } from "./contracts";

export interface Env {
	AI: Ai;
	BROWSER: BrowserRun;
	CONTENT_BUCKET: R2Bucket;
	GENERATE_VIDEO_THUMBNAIL: Workflow<ThumbnailWorkflowParams>;
}
