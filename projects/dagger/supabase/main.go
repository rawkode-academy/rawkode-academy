package main

import "fmt"

// Ideally, Dagger would suport using docker-compose.yaml files
// and we wouldn't need to manually orchestrate all this.
// https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml
// Until then, let's go! 🚀

const POSTGRES_USERNAME = "postgres"
const POSTGRES_PASSWORD = "postgres"

const DASHBOARD_USERNAME = "dash"
const DASHBOARD_PASSWORD = "board"

const SUPABASE_URL = "http://localhost:8000"

const JWT_SECRET = "your-super-secret-jwt-token-with-at-least-32-characters-long"
const JWT_EXPIRY = "3600"
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE"
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q"

const LOGFLARE_LOGGER_BACKEND_API_KEY = "your-super-secret-and-long-logflare-key"
const LOGFLARE_API_KEY = "your-super-secret-and-long-logflare-key"

type Supabase struct {
	ProjectName string
	SiteUrl     string
	JwtSecret   string
	JwtExpiry   int
}

type Return struct {
	Analytics  *Service
	Auth       *Service
	Functions  *Service
	ImageProxy *Service
	Kong       *Service
	Meta       *Service
	Postgres   *Service
	Postgrest  *Service
	RealTime   *Service
	Storage    *Service
	Studio     *Service
}

func (m *Supabase) DevStack(projectName string, siteUrl string) *Return {
	m.ProjectName = projectName
	m.SiteUrl = siteUrl

	postgres := m.postgres()

	imgproxy := m.imgproxy()

	analytics := m.analytics(postgres)
	postgrest := m.postgrest(postgres)

	auth := m.auth(postgres)
	meta := m.meta(postgres)

	functions := m.functions(analytics)

	storage := m.storage(imgproxy, postgres, postgrest)

	realtime := m.realtime(analytics, postgres)

	studio := m.studio(analytics, meta)
	kong := m.kong(studio, auth, meta, postgrest, storage, functions, realtime)

	return &Return{
		Analytics:  analytics,
		Auth:       auth,
		Functions:  functions,
		ImageProxy: imgproxy,
		Kong:       kong,
		Meta:       meta,
		Postgres:   postgres,
		Postgrest:  postgrest,
		RealTime:   realtime,
		Storage:    storage,
		Studio:     studio,
	}
}

func (m *Supabase) studio(analytics *Service, meta *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/studio:20231218-8c2c609").
		WithServiceBinding("analytics", analytics).
		WithServiceBinding("meta", meta).
		WithEnvVariable("DEFAULT_ORGANIZATION_NAME", "Default Organization").
		WithEnvVariable("DEFAULT_PROJECT_NAME", "Default Project").
		WithEnvVariable("SUPABASE_URL", "http://kong:8000").
		WithEnvVariable("SUPABASE_PUBLIC_URL", SUPABASE_URL).
		WithEnvVariable("STUDIO_PG_META_URL", "http://meta:8080").
		WithEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("SUPABASE_ANON_KEY", ANON_KEY).
		WithEnvVariable("SUPABASE_SERVICE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("LOGFLARE_API_KEY", LOGFLARE_API_KEY).
		WithEnvVariable("LOGFLARE_URL", "http://analytics:4000").
		WithEnvVariable("NEXT_ANALYTICS_BACKEND_PROVIDER", "postgres").
		WithEnvVariable("NEXT_PUBLIC_ENABLE_LOGS", "true").
		WithExposedPort(3000).
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
		From("public.ecr.aws/supabase/postgres:aio-15.1.0.152").
		WithEnvVariable("POSTGRES_PORT", "5432").
		WithEnvVariable("POSTGRES_USERNAME", POSTGRES_USERNAME).
		WithEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("POSTGRES_DB", "supabase").
		WithEnvVariable("JWT_SECRET", JWT_SECRET).
		WithEnvVariable("JWT_EXP", JWT_EXPIRY).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql", webhookSql).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/99-roles.sql", rolesSql).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql", jwtSql).
		WithMountedFile("/docker-entrypoint-initdb.d/migrations/99-realtime.sql", realtimeSql).
		WithMountedFile("/docker-entrypoint-initdb.d/migrations/99-logs.sql", logSql).
		WithExec([]string{
			"postgres",
			"-c",
			"config_file=/etc/postgresql/postgresql.conf",
			"-c",
			"search_path=\"$user\",public,extensions",
			"-c",
			"log_min_messages=fatal",
		}).
		WithExposedPort(5432).
		AsService()
}

func (m *Supabase) postgrest(db *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/postgrest:v11.2.2").
		WithServiceBinding("db", db).
		WithEnvVariable("PGRST_DB_URI", "postgres://authenticator:"+POSTGRES_PASSWORD+"@db:5432/postgres").
		WithEnvVariable("PGRST_DB_SCHEMAS", "public,storage,graphql_public").
		WithEnvVariable("PGRST_DB_ANON_ROLE", "anon").
		WithEnvVariable("PGRST_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("PGRST_DB_USE_LEGACY_GUCS", "false").
		WithEnvVariable("PGRST_APP_SETTINGS_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("PGRST_APP_SETTINGS_JWT_EXP", JWT_EXPIRY).
		WithExposedPort(3000).
		AsService()
}

func (m *Supabase) analytics(db *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/logflare:1.4.0").
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

func (m *Supabase) auth(db *Service) *Service {
	auth := dag.
		Container().
		From("public.ecr.aws/supabase/gotrue:v2.130.0").
		WithServiceBinding("db", db).
		WithEnvVariable("GOTRUE_API_HOST", "0.0.0.0").
		WithEnvVariable("GOTRUE_API_PORT", "9999").
		WithEnvVariable("API_EXTERNAL_URL", SUPABASE_URL).
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
		WithEnvVariable("GOTRUE_JWT_ISSUER", fmt.Sprintf("%s/auth/v1", SUPABASE_URL)).
		WithEnvVariable("GOTRUE_EXTERNAL_EMAIL_ENABLED", "true").
		WithEnvVariable("GOTRUE_MAILER_AUTOCONFIRM", "true").
		WithEnvVariable("GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED", "true").
		WithEnvVariable("GOTRUE_SMTP_HOST", "supabase_inbucket_"+m.ProjectName).
		WithEnvVariable("GOTRUE_SMTP_PORT", "2500").
		WithEnvVariable("GOTRUE_SMTP_ADMIN_EMAIL", "admin@email.com").
		WithEnvVariable("GOTRUE_SMTP_MAX_FREQUENCY", "1s").
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_INVITE", fmt.Sprintf("%s/auth/v1/verify", SUPABASE_URL)).
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_CONFIRMATION", fmt.Sprintf("%s/auth/v1/verify", SUPABASE_URL)).
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_RECOVERY", fmt.Sprintf("%s/auth/v1/verify", SUPABASE_URL)).
		WithEnvVariable("GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE", fmt.Sprintf("%s/auth/v1/verify", SUPABASE_URL)).
		WithEnvVariable("GOTRUE_RATE_LIMIT_EMAIL_SENT", "360000").
		WithEnvVariable("GOTRUE_EXTERNAL_PHONE_ENABLED", "false").
		WithEnvVariable("GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED", "true").
		WithEnvVariable("GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL", "10")

	return m.authGitHub(auth).
		WithExposedPort(9999).
		AsService()
}

func (m *Supabase) authGitHub(c *Container) *Container {
	return c.WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_ENABLED", "true").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_CLIENT_ID", "").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_SECRET", "").
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI", fmt.Sprintf("%s/auth/v1/callback", SUPABASE_URL))
}

func (m *Supabase) kong(studio *Service, auth *Service, meta *Service, postgrest *Service, storage *Service, functions *Service, realtime *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/kong:2.8.1").
		WithServiceBinding("auth", auth).
		WithServiceBinding("meta", meta).
		WithServiceBinding("rest", postgrest).
		WithServiceBinding("studio", studio).
		WithServiceBinding("storage", storage).
		WithServiceBinding("functions", functions).
		WithServiceBinding("realtime", realtime).
		WithEnvVariable("KONG_DATABASE", "off").
		WithEnvVariable("KONG_DECLARATIVE_CONFIG", "/home/kong/kong.yaml").
		WithEnvVariable("KONG_DNS_ORDER", "LAST,A,CNAME").
		WithEnvVariable("KONG_PLUGINS", "request-transformer,cors,key-auth,acl,basic-auth").
		WithEnvVariable("KONG_NGINX_PROXY_PROXY_BUFFER_SIZE", "160k").
		WithEnvVariable("KONG_NGINX_PROXY_PROXY_BUFFERS", "64 160k").
		WithEnvVariable("SUPABASE_ANON_KEY", ANON_KEY).
		WithEnvVariable("SUPABASE_SERVICE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("DASHBOARD_USERNAME", DASHBOARD_USERNAME).
		WithEnvVariable("DASHBOARD_PASSWORD", DASHBOARD_PASSWORD).
		WithMountedFile("/tmp/temp.yaml", dag.Host().File("./config/kong.yaml")).
		WithExec([]string{
			"bash",
			"-c",
			"eval \"echo \\\"$(cat /tmp/temp.yaml)\\\"\" > /home/kong/kong.yaml && /docker-entrypoint.sh kong docker-start",
		}).
		WithExposedPort(8000).
		WithExposedPort(8443).
		AsService()
}

func (m *Supabase) meta(db *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/postgres-meta:v0.75.0").
		WithServiceBinding("db", db).
		WithEnvVariable("PG_META_DB_HOST", "db").
		WithEnvVariable("PG_META_DB_PORT", "5432").
		WithEnvVariable("PG_META_DB_NAME", "postgres").
		WithEnvVariable("PG_META_DB_USER", "supabase_admin").
		WithEnvVariable("PG_META_DB_PASSWORD", POSTGRES_PASSWORD).
		AsService()
}

func (m *Supabase) inbucket() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/inbucket:3.0.3").
		AsService()
}

func (m *Supabase) realtime(analytics *Service, db *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/realtime:v2.25.44").
		WithServiceBinding("analytics", analytics).
		WithServiceBinding("db", db).
		WithEnvVariable("PORT", "4000").
		WithEnvVariable("DB_HOST", "db").
		WithEnvVariable("DB_PORT", "5432").
		WithEnvVariable("DB_USER", "supabase_admin").
		WithEnvVariable("DB_NAME", "postgres").
		WithEnvVariable("DB_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("DB_AFTER_CONNECT_QUERY", "SET search_path TO _realtime").
		WithEnvVariable("DB_ENC_KEY", "supabaserealtime").
		WithEnvVariable("API_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("SECRET_KEY_BASE", "EAx3IQ/wRG1v47ZD4NE4/9RzBI8Jmil3x0yhcW4V2NHBP6c2iPIzwjofi2Ep4HIG").
		WithEnvVariable("ENABLE_TAILSCALE", "false").
		WithEnvVariable("DNS_NODES", "''").
		WithEnvVariable("REALTIME_IP_VERSION", "IPv6").
		WithExec([]string{
			"-s",
			"-g",
			"--",
			"/app/limits.sh",
			"/bin/sh",
			"-c",
			"/app/bin/migrate && /app/bin/realtime eval 'Realtime.Release.seeds(Realtime.Repo)' && /app/bin/server",
		}).
		AsService()
}

func (m *Supabase) imgproxy() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/imgproxy:v1.2.0").
		WithEnvVariable("IMGPROXY_BIND", "0.0.0.0:5001").
		WithEnvVariable("IMGPROXY_LOCAL_FILESYSTEM_ROOT", "/").
		WithEnvVariable("IMGPROXY_USE_ETAG", "true").
		WithEnvVariable("IMGPROXY_ENABLE_WEBP_DETECTION", "true").
		AsService()
}

func (m *Supabase) storage(imgproxy *Service, db *Service, rest *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/storage-api:v0.43.12").
		WithServiceBinding("db", db).
		WithServiceBinding("imgproxy", imgproxy).
		WithServiceBinding("rest", rest).
		WithEnvVariable("ANON_KEY", ANON_KEY).
		WithEnvVariable("SERVICE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("POSTGREST_URL", "http://rest:3000").
		WithEnvVariable("PGRST_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("DATABASE_URL", "postgres://supabase_storage_admin:"+POSTGRES_PASSWORD+"@db:5432/postgres").
		WithEnvVariable("FILE_SIZE_LIMIT", "52428800").
		WithEnvVariable("STORAGE_BACKEND", "file").
		WithEnvVariable("FILE_STORAGE_BACKEND_PATH", "/var/lib/storage").
		WithEnvVariable("TENANT_ID", "stub").
		WithEnvVariable("REGION", "stub").
		WithEnvVariable("GLOBAL_S3_BUCKET", "stub").
		WithEnvVariable("ENABLE_IMAGE_TRANSFORMATION", "true").
		WithEnvVariable("IMGPROXY_URL", "http://imgproxy:5001").
		AsService()
}

func (m *Supabase) functions(analytics *Service) *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/edge-runtime:v1.29.1").
		WithServiceBinding("analytics", analytics).
		WithEnvVariable("JWT_SECRET", JWT_SECRET).
		WithEnvVariable("SUPABASE_URL", "http://kong:8000").
		WithEnvVariable("SUPABASE_ANON_KEY", ANON_KEY).
		WithEnvVariable("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("SUPABASE_DB_URL", "postgres://postgres:"+POSTGRES_PASSWORD+"@db:5432/postgres").
		WithEnvVariable("VERIFY_JWT", "false").
		AsService()
}
