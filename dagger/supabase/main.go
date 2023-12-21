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

func (m *Supabase) DevStack(projectName string, siteUrl string, postgresPassword *Secret, jwtSecret *Secret, anonKey *Secret, serviceRoleKey *Secret, adminApiKey *Secret, githubClientId *Secret, githubClientSecret *Secret) *Supabase {
	// Giving up, for now, trying to get this running like producation.
	// All in one image it is ...
	// Want the 'producation' code? Checkout commit
	//   - dcc6262a11d455c2b987a80434291f37b66e14c6
	m.Service = dag.Container().From("public.ecr.aws/supabase/postgres:aio-15.1.0.153").
		WithSecretVariable("POSTGRES_PASSWORD", postgresPassword).
		WithSecretVariable("JWT_SECRET", jwtSecret).
		WithSecretVariable("ANON_KEY", anonKey).
		WithSecretVariable("SERVICE_ROLE_KEY", serviceRoleKey).
		WithSecretVariable("ADMIN_API_KEY", adminApiKey).
		WithEnvVariable("MACHINE_TYPE", "shared_cpu_1x_512m").
		WithExposedPort(5432).
		WithExposedPort(8000).
		AsService()

	return m
}
