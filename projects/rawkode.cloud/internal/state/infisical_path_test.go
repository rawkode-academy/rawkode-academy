package state

import "testing"

func TestNormalizeSecretPath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "", want: "/"},
		{input: "/", want: "/"},
		{input: "projects/rawkode-cloud", want: "/projects/rawkode-cloud"},
		{input: "/projects/rawkode-cloud/", want: "/projects/rawkode-cloud"},
		{input: " /projects//rawkode-cloud// ", want: "/projects/rawkode-cloud"},
	}

	for _, tt := range tests {
		got := normalizeSecretPath(tt.input)
		if got != tt.want {
			t.Fatalf("normalizeSecretPath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestClusterSecretPath(t *testing.T) {
	tests := []struct {
		base    string
		cluster string
		want    string
	}{
		{base: "/", cluster: "production", want: "/production"},
		{base: "/projects/rawkode-cloud", cluster: "production", want: "/projects/rawkode-cloud/production"},
		{base: "/projects/rawkode-cloud/", cluster: "production", want: "/projects/rawkode-cloud/production"},
		{base: "/projects/rawkode-cloud/production", cluster: "production", want: "/projects/rawkode-cloud/production"},
		{base: "/projects/rawkode-cloud", cluster: "", want: "/projects/rawkode-cloud"},
	}

	for _, tt := range tests {
		got := clusterSecretPath(tt.base, tt.cluster)
		if got != tt.want {
			t.Fatalf("clusterSecretPath(%q, %q) = %q, want %q", tt.base, tt.cluster, got, tt.want)
		}
	}
}
