package teleport

import (
	"context"
	"fmt"

	apiclient "github.com/gravitational/teleport/api/client"
)

// newClient creates a Teleport API client using the local tsh profile credentials.
// This is equivalent to the authentication provided by `tsh login`.
func newClient(ctx context.Context, proxyAddr string) (*apiclient.Client, error) {
	clt, err := apiclient.New(ctx, apiclient.Config{
		Addrs:       []string{proxyAddr},
		Credentials: []apiclient.Credentials{apiclient.LoadProfile("", "")},
	})
	if err != nil {
		return nil, fmt.Errorf("connect to teleport proxy %s (run 'tsh login' first): %w", proxyAddr, err)
	}

	return clt, nil
}
