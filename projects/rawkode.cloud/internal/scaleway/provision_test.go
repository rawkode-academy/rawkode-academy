package scaleway

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestBuildCloudInit_CloudConfigWrapper(t *testing.T) {
	cloudInit := BuildCloudInit("stable", []byte(`{"ignition":{"version":"3.4.0"}}`))

	if !strings.HasPrefix(cloudInit, "#cloud-config\n") {
		t.Fatalf("cloud-init should be cloud-config YAML, got:\n%s", cloudInit)
	}

	if !strings.Contains(cloudInit, "write_files:") {
		t.Fatal("cloud-init should define write_files")
	}

	if !strings.Contains(cloudInit, "runcmd:") {
		t.Fatal("cloud-init should define runcmd")
	}
}

func TestBuildCloudInit_EmbeddedPivotScript(t *testing.T) {
	channel := "stable"
	cloudInit := BuildCloudInit(channel, []byte(`{"ignition":{"version":"3.4.0"}}`))
	script := decodePivotScriptFromCloudInit(t, cloudInit)

	if !strings.Contains(script, "set -euo pipefail") {
		t.Error("pivot script must contain 'set -euo pipefail' for safety")
	}

	if !strings.Contains(script, "set -x") {
		t.Error("pivot script must enable xtrace with 'set -x'")
	}

	if !strings.Contains(script, "base64 -d /tmp/ignition.b64 > /tmp/ignition.json") {
		t.Error("pivot script must decode ignition from /tmp/ignition.b64")
	}

	if !strings.Contains(script, "https://raw.githubusercontent.com/flatcar/init/flatcar-master/bin/flatcar-install") {
		t.Error("pivot script must download flatcar-install")
	}

	if !strings.Contains(script, "-C "+channel) {
		t.Errorf("pivot script should use channel %s", channel)
	}

	if !strings.Contains(script, "findmnt") {
		t.Error("pivot script should detect boot disk using findmnt")
	}

	if !strings.Contains(script, "reboot") {
		t.Error("pivot script must reboot after installing Flatcar")
	}

	if !strings.Contains(script, "apt-get install -y -qq bzip2") {
		t.Error("pivot script must install bzip2 dependency")
	}

	if !strings.Contains(script, "TARGET_DISK=\"\"") {
		t.Error("pivot script must initialize TARGET_DISK before detection")
	}

	if !strings.Contains(script, "PKNAME=$(lsblk -ndo PKNAME") {
		t.Error("pivot script must attempt PKNAME disk detection")
	}

	if !strings.Contains(script, "TARGET_DISK=$(lsblk -dnpo NAME -e 7,11 | head -1)") {
		t.Error("pivot script must fallback to the first block device when PKNAME is unavailable")
	}
}

func TestBuildCloudInit_DifferentChannels(t *testing.T) {
	cloudInitStable := BuildCloudInit("stable", []byte(`{}`))
	cloudInitBeta := BuildCloudInit("beta", []byte(`{}`))

	if cloudInitStable == cloudInitBeta {
		t.Error("cloud-init payloads for different channels should be different")
	}

	betaScript := decodePivotScriptFromCloudInit(t, cloudInitBeta)
	if !strings.Contains(betaScript, "-C beta") {
		t.Error("pivot script should pass the beta channel to flatcar-install")
	}
}

func decodePivotScriptFromCloudInit(t *testing.T, cloudInit string) string {
	t.Helper()

	const contentMarker = "content: |\n"
	start := strings.Index(cloudInit, contentMarker)
	if start == -1 {
		t.Fatal("cloud-init missing write_files content block")
	}
	start += len(contentMarker)

	end := strings.Index(cloudInit[start:], "\nruncmd:\n")
	if end == -1 {
		t.Fatal("cloud-init missing runcmd after content block")
	}

	block := cloudInit[start : start+end]
	var b64Lines []string
	for _, line := range strings.Split(block, "\n") {
		if line == "" {
			continue
		}
		b64Lines = append(b64Lines, strings.TrimPrefix(line, "      "))
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.Join(b64Lines, ""))
	if err != nil {
		t.Fatalf("decode embedded pivot script: %v", err)
	}

	return string(decoded)
}
