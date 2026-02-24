package main

import (
	"fmt"
	"os"

	"github.com/rawkode-academy/rawkode-cloud3/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
