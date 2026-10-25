// Worker bindings for the CMS, read from `cloudflare:workers` at request time.
import type { ContentWriteRpc } from "@rawkodeacademy/content-write/worker";
import type { ApiEnv } from "./api";
import { BINDINGS, type Binding } from "./collections";

export interface CmsBindings extends Partial<Record<Binding, ContentWriteRpc>> {
	DB: D1Database;
	MEDIA?: R2Bucket;
	MEDIA_BASE_URL?: string;
}

export async function cmsBindings(): Promise<CmsBindings> {
	const { env } = await import("cloudflare:workers");
	return env as unknown as CmsBindings;
}

export async function apiEnv(): Promise<ApiEnv> {
	const bindings = await cmsBindings();
	const services: ApiEnv["services"] = {};
	for (const binding of BINDINGS) {
		const svc = bindings[binding];
		if (svc) services[binding] = svc;
	}
	return {
		DB: bindings.DB,
		services,
		...(bindings.MEDIA ? { MEDIA: bindings.MEDIA } : {}),
		...(bindings.MEDIA_BASE_URL
			? { mediaBaseUrl: bindings.MEDIA_BASE_URL }
			: {}),
	};
}
