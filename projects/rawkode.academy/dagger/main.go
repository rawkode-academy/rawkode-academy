package main

import (
	"context"
	"os"
)

type RawkodeAcademy struct{}

func (m *RawkodeAcademy) Dev(ctx context.Context) *Service {
	postgresPassword := dag.SetSecret("postgresPassword", os.Getenv("SUPABASE_POSTGRES_PASSWORD"))
	jwtSecret := dag.SetSecret("jwtSecret", os.Getenv("SUPABASE_JWT_SECRET"))
	anonKey := dag.SetSecret("anonKey", os.Getenv("SUPABASE_ANON_KEY"))
	serviceRoleKey := dag.SetSecret("serviceRoleKey", os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	adminApiKey := dag.SetSecret("adminApiKey", os.Getenv("SUPABASE_ADMIN_API_KEY"))
	githubClientId := dag.SetSecret("githubClientId", os.Getenv("GITHUB_CLIENT_ID"))
	githubClientSecret := dag.SetSecret("githubClientSecret", os.Getenv("GITHUB_CLIENT_SECRET"))

	supabase := dag.Supabase().DevStack("rawkode-academy", "http://localhost:4321", postgresPassword, jwtSecret, anonKey, serviceRoleKey, adminApiKey, githubClientId, githubClientSecret)

  return supabase.Service()
}
