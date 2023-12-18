package main

import "strconv"

const POSTGRES_USERNAME = "postgres"
const POSTGRES_PASSWORD = "postgres"

// Ideally, Dagger would suport using docker-compose.yaml files
// and we wouldn't need to manually orchestrate all this.
// https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml
// Until then, let's go! 🚀
type Supabase struct {
	ProjectName string
	SiteUrl     string
	JwtSecret   string
	JwtExpiry   int
}

type Return struct {
	Analytics *Service
	Auth      *Service
	Kong      *Service
	Meta      *Service
	Postgres  *Service
	Postgrest *Service
	Storage   *Service
}

func (m *Supabase) DevStack(stringArg string) *Return {
	postgres := m.postgres()

	analytics := m.analytics(postgres)
	auth := m.auth(postgres, analytics)
	kong := m.kong(analytics)
	meta := m.meta(postgres, analytics)
	postgrest := m.postgrest(postgres, analytics)
	storage := m.storage()

	return &Return{
		Analytics: analytics,
		Auth:      auth,
		Kong:      kong,
		Meta:      meta,
		Postgres:  postgres,
		Postgrest: postgrest,
		Storage:   storage,
	}
}

func (m *Supabase) postgres() *Service {
	realtimeSql := dag.Host().File("./config/sql/realtime.sql")
	logSql := dag.Host().File("./config/sql/logs.sql")
	jwtSql := dag.Host().File("./config/sql/jwt.sql")
	rolesSql := dag.Host().File("./config/sql/roles.sql")
	webhookSql := dag.Host().File("./config/sql/webhook.sql")

	return dag.
		Container().
		From("supabase/postgres:15.1.0.117").
		WithExec([]string{
			"postgres",
			"-c",
			"config_file=/etc/postgresql/postgresql.conf",
			"-c",
			"log_min_messages=fatal",
		}).
		WithEnvVariable("POSTGRES_HOST", "/var/run/postgresql").
		WithEnvVariable("POSTGRES_PORT", "55432").
		WithEnvVariable("POSTGRES_USERNAME", POSTGRES_USERNAME).
		WithEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("POSTGRES_DB", "supabase").
		WithEnvVariable("JWT_SECRET", m.JwtSecret).
		WithEnvVariable("JWT_EXP", strconv.Itoa(m.JwtExpiry)).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql:Z", webhookSql).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:Z", rolesSql).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql:Z", jwtSql).
		WithMountedFile("/docker-entrypoint-initdb.d/migrations/99-realtime.sql:Z", realtimeSql).
		WithMountedFile("/docker-entrypoint-initdb.d/migrations/99-logs.sql:Z", logSql).
		WithExposedPort(5432).
		AsService()
}

func (m *Supabase) postgrest(db *Service, analytics *Service) *Service {
	return dag.
		Container().
		From("postgrest/postgrest:v11.2.2").
		WithExec([]string{
			"postgrest",
		}).
		WithEnvVariable("PGRST_DB_URI", "postgres://authenticator:"+POSTGRES_PASSWORD+"@db:5432/supabase").
		WithEnvVariable("PGRST_DB_SCHEMAS", "public").
		WithEnvVariable("PGRST_DB_ANON_ROLE", "anon").
		WithEnvVariable("PGRST_JWT_SECRET", m.JwtSecret).
		WithEnvVariable("PGRST_DB_USE_LEGACY_GUCS", "false").
		WithEnvVariable("PGRST_APP_SETTINGS_JWT_SECRET", m.JwtSecret).
		WithEnvVariable("PGRST_APP_SETTINGS_JWT_EXP", strconv.Itoa(m.JwtExpiry)).
		WithServiceBinding("db", db).
		WithServiceBinding("analytics", analytics).
		WithExposedPort(55432).
		AsService()
}

func (m *Supabase) analytics(db *Service) *Service {
	return dag.
		Container().
		From("supabase/logflare:1.4.0").
		WithExposedPort(4000).
		WithServiceBinding("db", db).
		AsService()
}

func (m *Supabase) auth(db *Service, analytics *Service) *Service {
	auth := dag.
		Container().
		From("supabase/gotrue:v2.125.1").
		WithExec([]string{
			"gotrue",
		}).
		WithEnvVariable("GOTRUE_API_HOST", "0.0.0.0").
		WithEnvVariable("GOTRUE_API_PORT", "9999").
		WithEnvVariable("API_EXTERNAL_URL", "http://127.0.0.1:54321").
		WithEnvVariable("GOTRUE_DB_DRIVER", "postgres").
		WithEnvVariable("GOTRUE_DB_DATABASE_URL", "postgres://supabase_auth_admin:"+POSTGRES_PASSWORD+"@db:5432/postgres").
		WithEnvVariable("GOTRUE_SITE_URL", m.SiteUrl).
		WithEnvVariable("GOTRUE_URI_ALLOW_LIST", m.SiteUrl).
		WithEnvVariable("GOTRUE_DISABLE_SIGNUP", "false").
		WithEnvVariable("GOTRUE_JWT_ADMIN_ROLES", "service_role").
		WithEnvVariable("GOTRUE_JWT_AUD", "authenticated").
		WithEnvVariable("GOTRUE_JWT_DEFAULT_GROUP_NAME", "authenticated").
		WithEnvVariable("GOTRUE_JWT_EXP", strconv.Itoa(m.JwtExpiry)).
		WithEnvVariable("GOTRUE_JWT_SECRET", m.JwtSecret).
		WithEnvVariable("GOTRUE_JWT_ISSUER", "http://127.0.0.1:54321/auth/v1").
		WithEnvVariable("GOTRUE_EXTERNAL_EMAIL_ENABLED", "true").
		WithEnvVariable("GOTRUE_MAILER_AUTOCONFIRM", "true").
		WithEnvVariable("GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED", "true").
		WithEnvVariable("GOTRUE_SMTP_HOST", "supabase_inbucket_"+m.ProjectName).
		WithEnvVariable("GOTRUE_SMTP_PORT", "2500").
		WithEnvVariable("GOTRUE_SMTP_ADMIN_EMAIL", "admin@email.com").
		WithEnvVariable("GOTRUE_SMTP_MAX_FREQUENCY", "1s").
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_INVITE", "http://127.0.0.1:54321/auth/v1/verify").
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_CONFIRMATION", "http://127.0.0.1:54321/auth/v1/verify").
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_RECOVERY", "http://127.0.0.1:54321/auth/v1/verify").
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE", "http://127.0.0.1:54321/auth/v1/verify").
		WithEnvVariable("GOTRUE_RATE_LIMIT_EMAIL_SENT", "360000").
		WithEnvVariable("GOTRUE_EXTERNAL_PHONE_ENABLED", "false").
		WithEnvVariable("GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED", "true").
		WithEnvVariable("GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL", "10").
		WithEnvVariable("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin").
		WithEnvVariable("GOTRUE_DB_MIGRATIONS_PATH", "/usr/local/etc/gotrue/migrations").
		WithServiceBinding("db", db).
		WithServiceBinding("analytics", analytics)

	return m.authGitHub(auth).AsService()
}

func (m *Supabase) authGitHub(c *Container) *Container {
	return c.WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_ENABLED", "true").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_CLIENT_ID", "").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_SECRET", "").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI", "http://localhost:54321/auth/v1/callback")
}

func (m *Supabase) storage() *Service {
	return dag.
		Container().
		From("minio/minio:RELEASE.2021-04-06T01-49-53Z").
		WithExec([]string{
			"minio",
			"server",
			"/data",
		}).
		WithEnvVariable("MINIO_ACCESS_KEY", "minio").
		WithEnvVariable("MINIO_SECRET_KEY", "minio123").
		WithEnvVariable("MINIO_REGION_NAME", "us-east-1").
		WithEnvVariable("MINIO_DOMAIN", "").AsService()
}

func (m *Supabase) kong(analytics *Service) *Service {
	return dag.
		Container().
		From("kong:2.8.1").
		WithEntrypoint([]string{
			"bash",
		}).
		WithExec([]string{
			"-c",
			"eval \"echo \"$$(cat ~/temp.yml)\"\" > ~/kong.yml && /docker-entrypoint.sh kong docker-start",
		}).
		WithServiceBinding("analytics", analytics).
		WithEnvVariable("KONG_DATABASE", "off").
		WithEnvVariable("KONG_DECLARATIVE_CONFIG", "/home/kong/kong.yml").
		WithEnvVariable("KONG_DNS_ORDER", "LAST,A,CNAME").
		WithEnvVariable("KONG_PLUGINS", "request-transformer,cors,key-auth,acl,basic-auth").
		WithEnvVariable("KONG_NGINX_PROXY_PROXY_BUFFER_SIZE", "160k").
		WithEnvVariable("KONG_NGINX_PROXY_PROXY_BUFFERS", "64 160k").
		WithEnvVariable("SUPABASE_ANON_KEY", "${ANON_KEY}").
		WithEnvVariable("SUPABASE_SERVICE_KEY", "${SERVICE_ROLE_KEY}").
		WithEnvVariable("DASHBOARD_USERNAME", "dash").
		WithEnvVariable("DASHBOARD_PASSWORD", "board").
		WithMountedFile("/home/kong/temp.yml:ro", dag.Host().File("./config/kong.yaml")).
		WithExposedPort(8000).
		WithExposedPort(8443).
		AsService()
}

// meta:
//   container_name: supabase-meta
//   image: supabase/postgres-meta:v0.75.0
//   depends_on:
//     db:
//       # Disable this if you are using an external Postgres database
//       condition: service_healthy
//     analytics:
//       condition: service_healthy
//   restart: unless-stopped
//   environment:
//     PG_META_PORT: 8080
//     PG_META_DB_HOST: ${POSTGRES_HOST}
//     PG_META_DB_PORT: ${POSTGRES_PORT}
//     PG_META_DB_NAME: ${POSTGRES_DB}
//     PG_META_DB_USER: supabase_admin
//     PG_META_DB_PASSWORD: ${POSTGRES_PASSWORD}
func (m *Supabase) meta(db *Service, analytics *Service) *Service {
	return dag.
		Container().
		From("supabase/postgres-meta:v0.75.0").
		WithServiceBinding("db", db).
		WithServiceBinding("analytics", analytics).
		WithEnvVariable("PG_META_PORT", "8080").
		WithEnvVariable("PG_META_DB_HOST", "db").
		WithEnvVariable("PG_META_DB_PORT", "5432").
		WithEnvVariable("PG_META_DB_NAME", "postgres").
		WithEnvVariable("PG_META_DB_USER", "supabase_admin").
		WithEnvVariable("PG_META_DB_PASSWORD", POSTGRES_PASSWORD).
		AsService()
}
