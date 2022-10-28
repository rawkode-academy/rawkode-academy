package doppler

import (
	"context"
	"encoding/json"

	"dagger.io/dagger"
)

type Config struct {
	Project string
	Config  string
}

type Secret struct {
	Value string `json:"computed"`
}

type Secrets map[string]Secret

func GetSecrets(config Config, ctx context.Context, client *dagger.Client) (Secrets, error) {
	dopplerToken, err := client.Host().EnvVariable("DOPPLER_TOKEN").Value(ctx)
	if err != nil {
		return nil, err
	}

	doppler := client.
		Container().
		From("dopplerhq/cli:3").
		WithEntrypoint([]string{"ash"}).
		WithEnvVariable("DOPPLER_PROJECT", config.Project).
		WithEnvVariable("DOPPLER_CONFIG", config.Config).
		WithEnvVariable("DOPPLER_TOKEN", dopplerToken)

	result := doppler.Exec(dagger.ContainerExecOpts{
		Args: []string{"-c", "doppler setup --no-save-token --no-interactive >/dev/null && doppler secrets --json"},
	})
	_, err = result.ExitCode(ctx)
	if err != nil {
		return nil, err
	}

	stdout, err := result.Stdout().Contents(ctx)
	if err != nil {
		return nil, err
	}

	secrets := make(Secrets)
	err = json.Unmarshal([]byte(stdout), &secrets)
	if err != nil {
		return nil, err
	}

	return secrets, nil
}
