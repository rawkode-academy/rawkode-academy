export interface Env {
  TFSTATE_BUCKET: R2Bucket;
	TFSTATE_LOCK: DurableObjectNamespace;
	ACCESS_SUBDOMAIN: string;
	ACCESS_AUDIENCE_TAG: string;
	TOKEN: string;
}
