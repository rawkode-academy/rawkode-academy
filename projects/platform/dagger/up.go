package dagger

import (
	"context"
	"fmt"

	"dagger.io/dagger"
	"github.com/RawkodeAcademy/RawkodeAcademy/dagger/doppler"
	"github.com/RawkodeAcademy/RawkodeAcademy/dagger/pulumi"
)

func Up(ctx context.Context, client *dagger.Client) error {
	secrets, err := doppler.GetSecrets(doppler.Config{
		Project: "platform",
		Config:  "production",
	}, ctx, client)
	if err != nil {
		return err
	}

	codeDirectory := client.Host().Directory(dagger.HostDirectoryID("platform")).Read()
	codeDirectoryId, err := codeDirectory.ID(ctx)
	if err != nil {
		return err
	}

	outputs, err := pulumi.Up(pulumi.Config{
		Version:     "latest",
		Runtime:     "nodejs",
		Stack:       "production",
		StackCreate: false,
		GCloudGke:   true,
		EnvironmentVariables: map[string]string{
			"GOOGLE_CREDENTIALS": secrets["GOOGLE_CREDENTIALS"].Value,
		},
		ProgramDir: codeDirectoryId,
	}, ctx, client)
	if err != nil {
		return err
	}

	fmt.Printf("Pulumi Outputs: %v", outputs)

	return err
}
