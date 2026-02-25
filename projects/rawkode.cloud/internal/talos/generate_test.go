package talos

import "testing"

func TestResolveInstallDisk(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "configured disk",
			input: "/dev/vda",
			want:  "/dev/vda",
		},
		{
			name:  "configured disk with whitespace",
			input: "  /dev/sda  ",
			want:  "/dev/sda",
		},
		{
			name:  "empty falls back to default",
			input: "",
			want:  defaultOSDisk,
		},
		{
			name:  "whitespace falls back to default",
			input: "   ",
			want:  defaultOSDisk,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveInstallDisk(tt.input); got != tt.want {
				t.Fatalf("resolveInstallDisk(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestAllowSchedulingOnControlPlanes(t *testing.T) {
	tests := []struct {
		name               string
		controlPlaneTaints bool
		want               bool
	}{
		{
			name:               "taints enabled keeps control plane isolated",
			controlPlaneTaints: true,
			want:               false,
		},
		{
			name:               "taints disabled allows control plane scheduling",
			controlPlaneTaints: false,
			want:               true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := allowSchedulingOnControlPlanes(tt.controlPlaneTaints); got != tt.want {
				t.Fatalf("allowSchedulingOnControlPlanes(%t) = %t, want %t", tt.controlPlaneTaints, got, tt.want)
			}
		})
	}
}
