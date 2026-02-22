package flatcar

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/rawkode-academy/rawkode-cloud/internal/infisical"
)

// JoinInfo holds the information needed for subsequent nodes to join the cluster.
type JoinInfo struct {
	Token                string
	CACertHash           string
	CertificateKey       string
	ControlPlaneEndpoint string
}

// StoreJoinInfo writes join info to Infisical so subsequent nodes can read it.
func StoreJoinInfo(ctx context.Context, infClient *infisical.Client, projectID, env, path string, info *JoinInfo) error {
	secrets := map[string]string{
		"K8S_JOIN_TOKEN":              info.Token,
		"K8S_CA_CERT_HASH":           info.CACertHash,
		"K8S_CERTIFICATE_KEY":        info.CertificateKey,
		"K8S_CONTROL_PLANE_ENDPOINT": info.ControlPlaneEndpoint,
	}

	for key, value := range secrets {
		if err := infClient.SetSecret(ctx, projectID, env, path, key, value); err != nil {
			return fmt.Errorf("store join info %s: %w", key, err)
		}
	}

	slog.Info("join info stored in Infisical",
		"project", projectID,
		"environment", env,
		"path", path,
	)
	return nil
}

// LoadJoinInfo reads join info from Infisical. Returns nil if no join token exists
// (indicating this should be the first node).
func LoadJoinInfo(ctx context.Context, infClient *infisical.Client, projectID, env, path string) (*JoinInfo, error) {
	token, err := infClient.GetSecret(ctx, projectID, env, path, "K8S_JOIN_TOKEN")
	if err != nil || token == "" {
		slog.Info("no existing join token found — this will be the init node")
		return nil, nil //nolint:nilnil // nil means "no join info exists"
	}

	caCertHash, err := infClient.GetSecret(ctx, projectID, env, path, "K8S_CA_CERT_HASH")
	if err != nil {
		return nil, fmt.Errorf("fetch CA cert hash: %w", err)
	}

	certKey, err := infClient.GetSecret(ctx, projectID, env, path, "K8S_CERTIFICATE_KEY")
	if err != nil {
		return nil, fmt.Errorf("fetch certificate key: %w", err)
	}

	endpoint, err := infClient.GetSecret(ctx, projectID, env, path, "K8S_CONTROL_PLANE_ENDPOINT")
	if err != nil {
		return nil, fmt.Errorf("fetch control plane endpoint: %w", err)
	}

	slog.Info("loaded join info from Infisical — this will be a joining node",
		"endpoint", endpoint,
	)

	return &JoinInfo{
		Token:                token,
		CACertHash:           caCertHash,
		CertificateKey:       certKey,
		ControlPlaneEndpoint: endpoint,
	}, nil
}
