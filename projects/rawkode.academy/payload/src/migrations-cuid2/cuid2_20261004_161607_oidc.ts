import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

// Preserve optional MCP evaluation tables. Auth state is owned by explicit SQL,
// not exposed as a Payload collection or included in automatic schema pruning.
export async function up({db}:MigrateUpArgs):Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`role\` text DEFAULT 'customer' NOT NULL;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`identity_key\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`oidc_issuer\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`oidc_subject\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`profile_email\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_identity_key_idx\` ON \`users\` (\`identity_key\`);`)
  // Existing POC accounts predate OIDC and remain local-only; no email identity linking.
  await db.run(sql`UPDATE users SET role='staff' WHERE identity_key IS NULL;`)
  await db.run(sql`CREATE TABLE poc_oidc_transactions (state_hash TEXT PRIMARY KEY, binding_hash TEXT NOT NULL, verifier TEXT NOT NULL, nonce TEXT NOT NULL, redirect_uri TEXT NOT NULL, expires_at INTEGER NOT NULL);`)
  await db.run(sql`CREATE INDEX poc_oidc_transactions_expiry ON poc_oidc_transactions(expires_at);`)
  await db.run(sql`CREATE TABLE poc_oidc_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);`)
  await db.run(sql`CREATE INDEX poc_oidc_sessions_expiry ON poc_oidc_sessions(expires_at);`)
}
export async function down({db}:MigrateDownArgs):Promise<void> {
  await db.run(sql`DROP TABLE poc_oidc_sessions;`)
  await db.run(sql`DROP TABLE poc_oidc_transactions;`)
  await db.run(sql`DROP INDEX users_identity_key_idx;`)
  await db.run(sql`ALTER TABLE users DROP COLUMN profile_email;`)
  await db.run(sql`ALTER TABLE users DROP COLUMN oidc_subject;`)
  await db.run(sql`ALTER TABLE users DROP COLUMN oidc_issuer;`)
  await db.run(sql`ALTER TABLE users DROP COLUMN identity_key;`)
  await db.run(sql`ALTER TABLE users DROP COLUMN role;`)
}
