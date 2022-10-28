package main

import (
	"context"
	"fmt"
	"os"

	"dagger.io/dagger"
	cloud "github.com/RawkodeAcademy/RawkodeAcademy/projects/rawkode.cloud/dagger"
)

func main() {
	ctx := context.Background()
	client, err := dagger.Connect(ctx, dagger.WithLogOutput(os.Stderr), dagger.WithLocalDir("rawkode.cloud", "."))

	if err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}
	defer client.Close()

	if err := cloud.Build(ctx, client); err != nil {
		fmt.Println(err)
	}
}
