package main

import (
	"fmt"
	"os"
)

const POSTGRES_USERNAME = "postgres"
const POSTGRES_PASSWORD = "postgres"

const DASHBOARD_USERNAME = "dash"
const DASHBOARD_PASSWORD = "board"

const SUPABASE_URL = "http://localhost:8000"

const JWT_EXPIRY = "3600"

var JWT_SECRET = os.Getenv("SUPABASE_JWT_SECRET")
var ANON_KEY = os.Getenv("SUPABASE_ANON_KEY")
var SERVICE_ROLE_KEY = os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

const LOGFLARE_LOGGER_BACKEND_API_KEY = "your-super-secret-and-long-logflare-key"
const LOGFLARE_API_KEY = "your-super-secret-and-long-logflare-key"

type Supabase struct {
	ProjectName string
	SiteUrl     string
	JwtSecret   string
	JwtExpiry   int

	// Analytics  *Service
	Auth       *Service
	// Functions  *Service
	ImageProxy *Service
	Kong       *Service
	Meta       *Service
	Postgres   *Service
	Postgrest  *Service
	RealTime   *Service
	Storage    *Service
	Studio     *Service

	githubClientId 	 *Secret
	githubClientSecret *Secret
}

func (m *Supabase) DevStack(projectName string, siteUrl string, githubClientId *Secret, githubClientSecret *Secret) *Supabase {
	m.ProjectName = projectName
	m.SiteUrl = siteUrl
	m.githubClientId = githubClientId
	m.githubClientSecret = githubClientSecret

	fmt.Println("ANON KEY", ANON_KEY)
	fmt.Println("SERVICE ROLE KEY", SERVICE_ROLE_KEY)

	m.init()

	return m
}

func (m *Supabase) init() {
	// analytics := m.analytics()
	// functions := m.functions()

	m.Postgres = m.postgres()
	m.ImageProxy = m.imgproxy()
	m.Postgrest = m.postgrest()
	m.Auth = m.auth()
	m.Meta = m.meta()
	m.Storage = m.storage()
	m.RealTime = m.realtime()
	m.Studio = m.studio()
	m.Kong = m.kong()
}

func (m *Supabase) studio() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/studio:20231218-8c2c609").
		// WithServiceBinding("analytics", analytics).
		WithServiceBinding("meta", m.Meta).
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
	schemaSql := dag.Host().File("./config/schema.sql")

	return dag.
		Container().
		From("public.ecr.aws/supabase/postgres:15.1.0.152").
		WithEnvVariable("POSTGRES_PORT", "5432").
		WithEnvVariable("POSTGRES_USERNAME", POSTGRES_USERNAME).
		WithEnvVariable("POSTGRES_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("POSTGRES_DB", "supabase").
		WithEnvVariable("JWT_SECRET", JWT_SECRET).
		WithEnvVariable("JWT_EXP", JWT_EXPIRY).
		WithMountedFile("/docker-entrypoint-initdb.d/init-scripts/99-schema.sql", schemaSql).
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

func (m *Supabase) postgrest() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/postgrest:v11.2.2").
		WithServiceBinding("postgres", m.Postgres).
		WithEnvVariable("PGRST_DB_URI", "postgresql://authenticator:"+POSTGRES_PASSWORD+"@postgres:5432/postgres").
		WithEnvVariable("PGRST_DB_SCHEMAS", "public,storage,graphql_public").
		WithEnvVariable("PGRST_DB_EXTRA_SEARCH_PATH", "public,extensions").
		WithEnvVariable("PGRST_DB_ANON_ROLE", "anon").
		WithEnvVariable("PGRST_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("PGRST_DB_MAX_ROWS", "1000").
		WithEnvVariable("PGRST_ADMIN_SERVER_PORT", "3001").
		WithExposedPort(3000).
		AsService()
}

func (m *Supabase) analytics() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/logflare:1.4.0").
		WithServiceBinding("postgres", m.Postgres).
		WithEnvVariable("LOGFLARE_NODE_HOST", "127.0.0.1").
		WithEnvVariable("DB_HOSTNAME", "postgres").
		WithEnvVariable("DB_PORT", "5432").
		WithEnvVariable("DB_USERNAME", "supabase_admin").
		WithEnvVariable("DB_PASSWORD", POSTGRES_PASSWORD).
		WithEnvVariable("DB_DATABASE", "postgres").
		WithEnvVariable("DB_SCHEMA", "_analytics").
		WithEnvVariable("LOGFLARE_API_KEY", LOGFLARE_API_KEY).
		WithEnvVariable("LOGFLARE_SINGLE_TENANT", "true").
		WithEnvVariable("LOGFLARE_SUPABASE_MODE", "true").
		WithEnvVariable("POSTGRES_BACKEND_URL", "postgresql://supabase_admin:"+POSTGRES_PASSWORD+"@postgres:5432/postgres").
		WithEnvVariable("POSTGRES_BACKEND_SCHEMA", "_analytics").
		WithEnvVariable("LOGFLARE_FEATURE_FLAG_OVERRIDE", "multibackend=true").
		WithExposedPort(4000).
		AsService()
}

func (m *Supabase) auth() *Service {
	auth := dag.
		Container().
		From("public.ecr.aws/supabase/gotrue:v2.130.0").
		WithServiceBinding("postgres", m.Postgres).
		WithEnvVariable("GOTRUE_API_HOST", "0.0.0.0").
		WithEnvVariable("GOTRUE_API_PORT", "9999").
		WithEnvVariable("API_EXTERNAL_URL", SUPABASE_URL).
		WithEnvVariable("GOTRUE_DB_DRIVER", "postgres").
    WithEnvVariable("GOTRUE_DB_DATABASE_URL", "postgresql://supabase_auth_admin:"+POSTGRES_PASSWORD+"@postgres:5432/postgres").
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
	WithExec([]string{
			"gotrue",
		}).
		WithExposedPort(9999).
		AsService()
}

func (m *Supabase) authGitHub(c *Container) *Container {
	return c.
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_ENABLED", "true").
		WithSecretVariable("GOTRUE_EXTERNAL_GITHUB_CLIENT_ID", m.githubClientId).
		WithSecretVariable("GOTRUE_EXTERNAL_GITHUB_CLIENT_SECRET", m.githubClientSecret).
		WithEnvVariable("GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI", fmt.Sprintf("%s/auth/v1/callback", SUPABASE_URL))
}

func (m *Supabase) kong() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/kong:2.8.1").
    WithServiceBinding("postgres", m.Postgres).
		WithServiceBinding("auth", m.Auth).
		WithServiceBinding("meta", m.Meta).
		WithServiceBinding("rest", m.Postgrest).
		WithServiceBinding("studio", m.Studio).
		WithServiceBinding("storage", m.Storage).
		// WithServiceBinding("functions", functions).
		WithServiceBinding("realtime", m.RealTime).
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
    WithExposedPort(8432).
		WithExposedPort(8443).
		AsService()
}

func (m *Supabase) meta() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/postgres-meta:v0.75.0").
		WithServiceBinding("postgres", m.Postgres).
		WithEnvVariable("PG_META_DB_HOST", "postgres").
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

func (m *Supabase) realtime() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/realtime:v2.25.44").
		// WithServiceBinding("analytics", analytics).
		WithServiceBinding("postgres", m.Postgres).
		WithEnvVariable("PORT", "4000").
		WithEnvVariable("DB_HOST", "postgres").
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
		WithEnvVariable("FLY_ALLOC_ID", "abc123").
		WithEnvVariable("FLY_APP_NAME", "realtime").
		WithExec([]string{
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

func (m *Supabase) storage() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/storage-api:v0.43.11").
		WithServiceBinding("postgres", m.Postgres).
		WithServiceBinding("imgproxy", m.ImageProxy).
		WithServiceBinding("rest", m.Postgrest).
		WithEnvVariable("POSTGREST_URL", "http://rest:3000").
		WithEnvVariable("ANON_KEY", ANON_KEY).
		WithEnvVariable("SERVICE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("PGRST_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("DATABASE_URL", "postgresql://supabase_storage_admin:"+POSTGRES_PASSWORD+"@postgres:5432/postgres").
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

func (m *Supabase) functions() *Service {
	return dag.
		Container().
		From("public.ecr.aws/supabase/edge-runtime:v1.29.1").
		// WithServiceBinding("analytics", analytics).
		WithServiceBinding("postgres", m.Postgres).
		WithEnvVariable("SUPABASE_URL", "http://kong:8000").
		WithEnvVariable("SUPABASE_ANON_KEY", ANON_KEY).
		WithEnvVariable("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY).
		WithEnvVariable("SUPABASE_DB_URL", "postgresql://postgres:"+POSTGRES_PASSWORD+"@postgres:5432/postgres").
		WithEnvVariable("SUPABASE_INTERNAL_JWT_SECRET", JWT_SECRET).
		WithEnvVariable("SUPABASE_INTERNAL_HOST_PORT", "8000").
		WithEnvVariable("SUPABASE_INTERNAL_FUNCTIONS_PATH", "/tmp").
		WithEnvVariable("SUPABASE_INTERNAL_FUNCTIONS_CONFIG", "{}").
		WithExec([]string{
      "start",
			"--main-service",
			"/tmp",
		}).
		AsService()
}
