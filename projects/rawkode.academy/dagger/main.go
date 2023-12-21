package main

import (
	"context"
	"os"
)

type RawkodeAcademy struct{}

func (m *RawkodeAcademy) Dev(ctx context.Context) *Service {
	githubClientId := dag.SetSecret("githubClientId", os.Getenv("GITHUB_CLIENT_ID"))
	githubClientSecret := dag.SetSecret("githubClientId", os.Getenv("GITHUB_CLIENT_SECRET"))

	supabase := dag.Supabase().DevStack("rawkode-academy", "http://localhost:4321", githubClientId, githubClientSecret)

  return supabase.Kong()
}
