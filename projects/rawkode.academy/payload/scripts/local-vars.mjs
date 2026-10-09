// Loopback overrides for local runtimes only. Never written to .dev.vars, which
// deploy-preview.mjs and deploy:preview-runtime ship to remote Workers as --secrets-file.
// The local staff fallback stays off by default; opt in with
// `bun run preview -- --var POC_DEV_LOCAL_AUTH:true`.
export const localVars = {
  OIDC_DIRECT_ORIGINS: '["http://127.0.0.1:3100"]',
  OIDC_BRIDGE_ORIGINS: '[]',
  REVIEW_PUBLIC_MEDIA_ORIGIN: 'http://127.0.0.1:3100',
  POC_DEV_LOCAL_AUTH: 'false',
}
