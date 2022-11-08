//go:build mage

package main

import (
	"context"
	"fmt"
	"os"

	"dagger.io/dagger"
	platform "github.com/RawkodeAcademy/RawkodeAcademy/projects/platform/dagger"
	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

var Default = Up

func Up() error {
	if os.Getenv("DOPPLER_TOKEN") == "" {
		return fmt.Errorf("DOPPLER_TOKEN is required")
	}

	mg.Deps(UpdatePorch)

	ctx := context.Background()
	client, err := dagger.Connect(ctx, dagger.WithLogOutput(os.Stderr), dagger.WithLocalDir("platform", "."))

	if err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}
	defer client.Close()

	return platform.Up(ctx, client)
}

func UpdatePorch() error {
	err := sh.Run("curl", "-o", "/tmp/latest-porch.tgz", "-fsSL", "https://github.com/GoogleContainerTools/kpt/releases/download/porch%2Fv0.0.12/deployment-blueprint.tar.gz")
	if err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}

	err = sh.Run("rm", "-rf", "/tmp/porch-install")
	if err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}

	err = sh.Run("mkdir", "/tmp/porch-install")
	if err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}

	err = sh.Run("tar", "-zxvf", "/tmp/latest-porch.tgz", "--directory=/tmp/porch-install")
	if err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}

	err = sh.Run("sh", "-c", "cat /tmp/porch-install/*.yaml > ./bootstrap/porch.yaml")
	if err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}

	return nil
}
