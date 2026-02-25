package cilium

import (
	"strings"
	"testing"
)

func TestInstallValuesTalosSafeDefaults(t *testing.T) {
	values := installValues(false, "")

	for _, required := range []string{
		"kubeProxyReplacement=true",
		"ipam.mode=kubernetes",
		"k8sServiceHost=localhost",
		"k8sServicePort=7445",
		"cgroup.autoMount.enabled=false",
		"cgroup.hostRoot=/sys/fs/cgroup",
		"securityContext.capabilities.ciliumAgent={CHOWN,KILL,NET_ADMIN,NET_RAW,IPC_LOCK,SYS_ADMIN,SYS_RESOURCE,DAC_OVERRIDE,FOWNER,SETGID,SETUID}",
		"securityContext.capabilities.cleanCiliumState={NET_ADMIN,SYS_ADMIN,SYS_RESOURCE}",
	} {
		if !containsValue(values, required) {
			t.Fatalf("missing required install value %q", required)
		}
	}
}

func TestInstallValuesOmitsSYSMODULECapability(t *testing.T) {
	values := installValues(false, "")
	for _, value := range values {
		if strings.HasPrefix(value, "securityContext.capabilities.") && strings.Contains(value, "SYS_MODULE") {
			t.Fatalf("install values must not include SYS_MODULE capability: %q", value)
		}
	}
}

func TestInstallValuesEnablesHubbleWhenRequested(t *testing.T) {
	values := installValues(true, "")
	for _, expected := range []string{
		"hubble.enabled=true",
		"hubble.relay.enabled=true",
		"hubble.ui.enabled=true",
	} {
		if !containsValue(values, expected) {
			t.Fatalf("missing expected Hubble value %q", expected)
		}
	}
}

func TestInstallValuesIncludesIPv4NativeRoutingCIDRWhenProvided(t *testing.T) {
	values := installValues(false, "172.16.16.0/22")
	if !containsValue(values, "ipv4NativeRoutingCIDR=172.16.16.0/22") {
		t.Fatalf("missing ipv4 native routing cidr install value")
	}
}

func containsValue(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
