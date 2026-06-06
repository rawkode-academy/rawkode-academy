import type { ThumbnailWorkflowParams } from "./contracts";

export interface Env {
	AI: Ai;
	BROWSER_RENDERING_API_TOKEN: SecretsStoreSecret;
	CLOUDFLARE_ACCOUNT_ID: string;
	CONTENT_BUCKET: R2Bucket;
	GENERATE_VIDEO_THUMBNAIL: Workflow<ThumbnailWorkflowParams>;
}
