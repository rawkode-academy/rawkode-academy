package main

import (
	"context"
	"fmt"
)

type RawkodeAcademy struct{}

func (m *RawkodeAcademy) Dev(ctx context.Context) {
	supabase := dag.Supabase().DevStack("rawkode-academy", "http://localhost:4321")

	tunnel, err := dag.Host().Tunnel(supabase.Studio()).Start(ctx)
	if err != nil {
		panic(err)
	}

  fmt.Printf("Studio available at: %v\n", tunnel.endpoint)

	defer tunnel.Stop(ctx)
  select {}
}
