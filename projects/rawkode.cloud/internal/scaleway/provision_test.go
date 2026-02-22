package scaleway

import (
	"strings"
	"testing"
)

func TestBuildCloudInit_ContainsVersion(t *testing.T) {
	version := "v1.9.5"
	script := BuildCloudInit(version)

	if !strings.Contains(script, version) {
		t.Errorf("cloud-init script should contain version %s", version)
	}
}

func TestBuildCloudInit_ContainsCorrectImageURL(t *testing.T) {
	version := "v1.9.5"
	script := BuildCloudInit(version)

	expectedURL := "https://github.com/siderolabs/talos/releases/download/v1.9.5/metal-amd64.raw.xz"
	if !strings.Contains(script, expectedURL) {
		t.Errorf("cloud-init script should contain image URL %s", expectedURL)
	}
}

func TestBuildCloudInit_ContainsChecksumURL(t *testing.T) {
	version := "v1.9.5"
	script := BuildCloudInit(version)

	expectedURL := "https://github.com/siderolabs/talos/releases/download/v1.9.5/sha256sum.txt"
	if !strings.Contains(script, expectedURL) {
		t.Errorf("cloud-init script should contain checksum URL %s", expectedURL)
	}
}

func TestBuildCloudInit_HasSafetyFlags(t *testing.T) {
	script := BuildCloudInit("v1.9.5")

	if !strings.Contains(script, "set -euo pipefail") {
		t.Error("cloud-init script must contain 'set -euo pipefail' for safety")
	}
}

func TestBuildCloudInit_HasChecksumVerification(t *testing.T) {
	script := BuildCloudInit("v1.9.5")

	if !strings.Contains(script, "sha256sum -c") {
		t.Error("cloud-init script must verify checksum before dd")
	}
}

func TestBuildCloudInit_HasDDCommand(t *testing.T) {
	script := BuildCloudInit("v1.9.5")

	if !strings.Contains(script, "dd if=/tmp/talos.raw of=/dev/sda") {
		t.Error("cloud-init script must write Talos image to disk")
	}
}

func TestBuildCloudInit_HasReboot(t *testing.T) {
	script := BuildCloudInit("v1.9.5")

	if !strings.Contains(script, "reboot") {
		t.Error("cloud-init script must reboot after writing disk")
	}
}

func TestBuildCloudInit_HasLogging(t *testing.T) {
	script := BuildCloudInit("v1.9.5")

	if !strings.Contains(script, "/var/log/talos-pivot.log") {
		t.Error("cloud-init script must log to /var/log/talos-pivot.log for debugging")
	}
}

func TestBuildCloudInit_NoHardcodedVersions(t *testing.T) {
	// Build with two different versions and ensure both produce unique output
	script1 := BuildCloudInit("v1.9.5")
	script2 := BuildCloudInit("v1.10.0")

	if script1 == script2 {
		t.Error("cloud-init scripts for different versions should be different")
	}

	if !strings.Contains(script2, "v1.10.0") {
		t.Error("cloud-init script should use the provided version, not a hardcoded one")
	}
}

func TestBuildCloudInit_HasBlockSize(t *testing.T) {
	script := BuildCloudInit("v1.9.5")

	if !strings.Contains(script, "bs=4M") {
		t.Error("cloud-init script should use bs=4M for efficient disk writes")
	}
}
