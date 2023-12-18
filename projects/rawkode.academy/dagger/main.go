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

  e, err := tunnel.Endpoint(ctx, ServiceEndpointOpts{
    Port: 3000,
    Scheme: "http",
  })
  	if err != nil {
		panic(err)
	}
  fmt.Println("Studio endpoint is: ", e)

	defer tunnel.Stop(ctx)
	select {}
}
