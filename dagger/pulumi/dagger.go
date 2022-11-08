package pulumi

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"dagger.io/dagger"
)

//go:embed scripts/up.sh
var UpScript string

type Config struct {
	Version              string
	Runtime              string
	Stack                string
	StackCreate          bool
	AccessToken          string
	Passphrase           string
	EnvironmentVariables map[string]string
	ProgramDir           dagger.DirectoryID
	GCloudGke            bool
}

type Outputs map[string]interface{}

func Up(config Config, ctx context.Context, client *dagger.Client) (Outputs, error) {
	entrypointDir := client.Directory().WithNewFile("up.sh", dagger.DirectoryWithNewFileOpts{
		Contents: UpScript,
	})

	entrypointDirId, err := entrypointDir.ID(ctx)
	if err != nil {
		return nil, err
	}

	var stackCreate string
	if config.StackCreate {
		stackCreate = "true"
	} else {
		stackCreate = "false"
	}

	pulumi := client.
		Container().
		From(fmt.Sprintf("pulumi/pulumi-%s:%s", config.Runtime, config.Version)).
		WithMountedDirectory("/entrypoint", entrypointDirId).
		WithMountedDirectory("/work", config.ProgramDir).
		WithWorkdir("/work").
		WithEntrypoint([]string{"bash"}).
		WithEnvVariable("PULUMI_RUNTIME", config.Runtime).
		WithEnvVariable("PULUMI_STACK", config.Stack).
		WithEnvVariable("PULUMI_STACK_CREATE", stackCreate)

	for key, value := range config.EnvironmentVariables {
		pulumi = pulumi.WithEnvVariable(key, value)
	}

	if config.GCloudGke {
		pulumi = pulumi.WithEnvVariable("GCLOUD_GKE", "YES")
	}

	result := pulumi.Exec(dagger.ContainerExecOpts{
		Args: []string{"/entrypoint/up.sh"},
	})
	_, err = result.ExitCode(ctx)
	if err != nil {
		return nil, err
	}

	output, err := result.File("/output/json").Contents(ctx)
	if err != nil {
		return nil, err
	}

	outputs := make(Outputs)
	err = json.Unmarshal([]byte(output), &outputs)
	if err != nil {
		return nil, err
	}

	return outputs, nil
}
