package main

// Ideally, Dagger would suport using docker-compose.yaml files
// and we wouldn't need to manually orchestrate all this.
// https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml
// Until then, let's go! 🚀

const POSTGRES_USERNAME = "postgres"
const POSTGRES_PASSWORD = "postgres"

const DASHBOARD_USERNAME = "dash"
const DASHBOARD_PASSWORD = "board"

const JWT_SECRET = "your-super-secret-jwt-token-with-at-least-32-characters-long"
const JWT_EXPIRY = "3600"
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE"
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q"

const STUDIO_PORT = 3000
const SUPABASE_PUBLIC_URL = "http://localhost:8000"

const LOGFLARE_LOGGER_BACKEND_API_KEY = "your-super-secret-and-long-logflare-key"
const LOGFLARE_API_KEY = "your-super-secret-and-long-logflare-key"

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
	Studio    *Service
}

func (m *Supabase) DevStack(projectName string, siteUrl string) *Return {
	m.ProjectName = projectName
	m.SiteUrl = siteUrl

	postgres := m.postgres()

	analytics := m.analytics(postgres)
	auth := m.auth(postgres, analytics)
	kong := m.kong(analytics)
	meta := m.meta(postgres, analytics)
	postgrest := m.postgrest(postgres, analytics)
  studio := m.studio(analytics, kong, meta)

	return &Return{
		Analytics: analytics,
		Auth:      auth,
		Kong:      kong,
		Meta:      meta,
		Postgres:  postgres,
		Postgrest: postgrest,
    Studio:    studio,
	}
}

func (m *Supabase) studio(analytics *Service, kong *Service, meta *Service) *Service {
	return dag.
		Container().
		From("supabase/studio:20231123-64a766a").
		WithServiceBinding("analytics", analytics).
		WithServiceBinding("meta", meta).
		WithServiceBinding("kong", kong).
		WithEnvVariable("STUDIO_PG_META_URL", "http://meta:8080").
		WithEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("DEFAULT_ORGANIZATION_NAME", "Default Organization").
		WithEnvVariable("DEFAULT_PROJECT_NAME", "Default Project").
		WithEnvVariable("SUPABASE_URL", "http://kong:8000").
		WithEnvVariable("SUPABASE_PUBLIC_URL", SUPABASE_PUBLIC_URL).
		WithEnvVariable("SUPABASE_ANON_KEY", ANON_KEY).
		WithEnvVariable("SUPABASE_SERVICE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("LOGFLARE_API_KEY", LOGFLARE_API_KEY).
		WithEnvVariable("LOGFLARE_URL", "http://analytics:4000").
		WithEnvVariable("NEXT_PUBLIC_ENABLE_LOGS", "true").
		WithEnvVariable("NEXT_ANALYTICS_BACKEND_PROVIDER", "postgres").
		WithExposedPort(STUDIO_PORT).
		AsService()
}

func (m *Supabase) postgres() *Service {
	realtimeSql := dag.Host().File("./config/sql/realtime.sql")
	logSql := dag.Host().File("./config/sql/logs.sql")
	jwtSql := dag.Host().File("./config/sql/jwt.sql")
	rolesSql := dag.Host().File("./config/sql/roles.sql")
	webhookSql := dag.Host().File("./config/sql/webhooks.sql")

	return dag.
		Container().
		From("supabase/postgres:15.1.0.117").
		WithUser("postgres").
		WithEnvVariable("POSTGRES_HOST", "/var/run/postgresql").
		WithEnvVariable("POSTGRES_PORT", "5432").
		WithEnvVariable("POSTGRES_USERNAME", POSTGRES_USERNAME).
		WithEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("POSTGRES_DB", "supabase").
		WithEnvVariable("JWT_SECRET", JWT_SECRET).
		WithEnvVariable("JWT_EXP", JWT_EXPIRY).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql:Z", webhookSql).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:Z", rolesSql).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql:Z", jwtSql).
		WithMountedFile("/docker-entrypoint-initdb.d/migrations/99-realtime.sql:Z", realtimeSql).
		WithMountedFile("/docker-entrypoint-initdb.d/migrations/99-logs.sql:Z", logSql).
		WithExec([]string{
			"postgres",
			"-c",
			"config_file=/etc/postgresql/postgresql.conf",
			"-c",
			"log_min_messages=fatal",
		}).
		WithExposedPort(5432).
		AsService()
}

func (m *Supabase) postgrest(db *Service, analytics *Service) *Service {
	return dag.
		Container().
		From("postgrest/postgrest:v11.2.2").
		WithServiceBinding("db", db).
		WithServiceBinding("analytics", analytics).
		WithEnvVariable("PGRST_DB_URI", "postgres://authenticator:"+POSTGRES_PASSWORD+"@db:5432/postgres").
		WithEnvVariable("PGRST_DB_SCHEMAS", "public,storage,graphql_public").
		WithEnvVariable("PGRST_DB_ANON_ROLE", "anon").
		WithEnvVariable("PGRST_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("PGRST_DB_USE_LEGACY_GUCS", "false").
		WithEnvVariable("PGRST_APP_SETTINGS_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("PGRST_APP_SETTINGS_JWT_EXP", JWT_EXPIRY).
		WithExec([]string{
			"postgrest",
		}).
		WithExposedPort(3000).
		AsService()
}

func (m *Supabase) analytics(db *Service) *Service {
	return dag.
		Container().
		From("supabase/logflare:1.4.0").
		WithServiceBinding("db", db).
    WithEnvVariable("LOGFLARE_NODE_HOST", "127.0.0.1").
    WithEnvVariable("DB_HOSTNAME", "db").
    WithEnvVariable("DB_PORT", "5432").
    WithEnvVariable("DB_USERNAME", "supabase_admin").
    WithEnvVariable("DB_PASSWORD", POSTGRES_PASSWORD).
    WithEnvVariable("DB_DATABASE", "postgres").
    WithEnvVariable("DB_SCHEMA", "_analytics").
    WithEnvVariable("LOGFLARE_API_KEY", LOGFLARE_API_KEY).
    WithEnvVariable("LOGFLARE_SINGLE_TENANT", "true").
    WithEnvVariable("LOGFLARE_SUPABASE_MODE", "true").
    WithEnvVariable("POSTGRES_BACKEND_URL", "postgresql://supabase_admin:"+POSTGRES_PASSWORD+"@db:5432/postgres").
    WithEnvVariable("POSTGRES_BACKEND_SCHEMA", "_analytics").
    WithEnvVariable("LOGFLARE_FEATURE_FLAG_OVERRIDE", "multibackend=true").
		WithExposedPort(4000).
		AsService()
}

func (m *Supabase) auth(db *Service, analytics *Service) *Service {
	auth := dag.
		Container().
		From("supabase/gotrue:v2.125.1").
		WithServiceBinding("db", db).
		WithServiceBinding("analytics", analytics).
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
		WithEnvVariable("GOTRUE_JWT_EXP", JWT_EXPIRY).
		WithEnvVariable("GOTRUE_JWT_SECRET", JWT_SECRET).
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
		WithEnvVariable("GOTRUE_DB_MIGRATIONS_PATH", "/usr/local/etc/gotrue/migrations")

	return m.authGitHub(auth).
		WithExec([]string{
			"gotrue",
		}).
		WithExposedPort(9999).
		AsService()
}

func (m *Supabase) authGitHub(c *Container) *Container {
	return c.WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_ENABLED", "true").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_CLIENT_ID", "").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_SECRET", "").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI", "http://localhost:54321/auth/v1/callback")
}

func (m *Supabase) kong(analytics *Service) *Service {
	return dag.
		Container().
		From("kong:2.8.1").
		WithServiceBinding("analytics", analytics).
		WithEnvVariable("KONG_DATABASE", "off").
		WithEnvVariable("KONG_DECLARATIVE_CONFIG", "/home/kong/kong.yml").
		WithEnvVariable("KONG_DNS_ORDER", "LAST,A,CNAME").
		WithEnvVariable("KONG_PLUGINS", "request-transformer,cors,key-auth,acl,basic-auth").
		WithEnvVariable("KONG_NGINX_PROXY_PROXY_BUFFER_SIZE", "160k").
		WithEnvVariable("KONG_NGINX_PROXY_PROXY_BUFFERS", "64 160k").
		WithEnvVariable("SUPABASE_ANON_KEY", ANON_KEY).
		WithEnvVariable("SUPABASE_SERVICE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("DASHBOARD_USERNAME", DASHBOARD_USERNAME).
		WithEnvVariable("DASHBOARD_PASSWORD", DASHBOARD_PASSWORD).
		WithMountedFile("/home/kong/temp.yml:ro", dag.Host().File("./config/kong.yaml")).
		WithExec([]string{
			"bash",
			"-c",
			"eval \"echo \"$$(cat ~/temp.yml)\"\" > ~/kong.yml && /docker-entrypoint.sh kong docker-start",
		}).
		WithExposedPort(8000).
		WithExposedPort(8443).
		AsService()
}

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
