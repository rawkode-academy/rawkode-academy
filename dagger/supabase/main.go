package main

const POSTGRES_USERNAME = "postgres"
const POSTGRES_PASSWORD = "postgres"

const DASHBOARD_USERNAME = "dash"
const DASHBOARD_PASSWORD = "board"

const SUPABASE_URL = "http://localhost:8000"

const JWT_EXPIRY = "3600"

const LOGFLARE_LOGGER_BACKEND_API_KEY = "your-super-secret-and-long-logflare-key"
const LOGFLARE_API_KEY = "your-super-secret-and-long-logflare-key"

type Supabase struct {
	Service *Service
}

type Configer struct {
	ProjectName        string
	SiteUrl            string
	PostgresPassword   *Secret
	JwtSecret          *Secret
	AnonKey            *Secret
	ServiceRoleKey     *Secret
	AdminApiKey        *Secret
	GitHubClientId     *Secret
	GitHubClientSecret *Secret
}

func (m *Supabase) DevStack(config *Configer) *Supabase {
	// Giving up, for now, trying to get this running like producation.
	// All in one image it is ...
	// Want the 'producation' code? Checkout commit
	//   - dcc6262a11d455c2b987a80434291f37b66e14c6
	m.Service = dag.Container().From("public.ecr.aws/supabase/postgres:aio-15.1.0.153").
		WithSecretVariable("POSTGRES_PASSWORD", config.PostgresPassword).
		WithSecretVariable("JWT_SECRET", config.JwtSecret).
		WithSecretVariable("ANON_KEY", config.AnonKey).
		WithSecretVariable("SERVICE_ROLE_KEY", config.ServiceRoleKey).
		WithSecretVariable("ADMIN_API_KEY", config.AdminApiKey).
		WithEnvVariable("MACHINE_TYPE", "shared_cpu_1x_512m").
		WithExposedPort(5432).
		WithExposedPort(8000).
		AsService()

	return m
}
