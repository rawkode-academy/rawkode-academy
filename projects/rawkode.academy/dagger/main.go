package main

import (
	"context"
)

type RawkodeAcademy struct{}

func (m *RawkodeAcademy) Dev(ctx context.Context) *Service {
	supabase := dag.Supabase().DevStack("rawkode-academy", "http://localhost:4321")

  return supabase.Kong()
}
