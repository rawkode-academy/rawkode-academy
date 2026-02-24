package talos

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// MachineConfigParams holds parameters for generating Talos machine configs.
type MachineConfigParams struct {
	ClusterName       string
	TalosVersion      string
	KubernetesVersion string
	TalosSchematic    string
	Role              string // "controlplane" or "worker"
	Endpoint          string // control plane endpoint (IP or DNS)
	OSDisk            string
}

// SecretsBundle holds the Talos secrets needed to generate machine configs.
// This is stored in Infisical.
type SecretsBundle struct {
	ClusterSecret    string `yaml:"clusterSecret" json:"clusterSecret"`
	ClusterCA        string `yaml:"clusterCA" json:"clusterCA"`
	ClusterCAKey     string `yaml:"clusterCAKey" json:"clusterCAKey"`
	MachineToken     string `yaml:"machineToken" json:"machineToken"`
	MachineCA        string `yaml:"machineCA" json:"machineCA"`
	MachineCAKey     string `yaml:"machineCAKey" json:"machineCAKey"`
	BootstrapToken   string `yaml:"bootstrapToken" json:"bootstrapToken"`
	AESCBCKey        string `yaml:"aesCBCKey" json:"aesCBCKey"`
	EtcdCA           string `yaml:"etcdCA" json:"etcdCA"`
	EtcdCAKey        string `yaml:"etcdCAKey" json:"etcdCAKey"`
	TalosToken       string `yaml:"talosToken" json:"talosToken"`
	TalosCA          string `yaml:"talosCA" json:"talosCA"`
	TalosCAKey       string `yaml:"talosCAKey" json:"talosCAKey"`
}

// GenerateMachineConfig builds a Talos machine configuration YAML.
// Uses the raw YAML approach for maximum control over the output.
func GenerateMachineConfig(params MachineConfigParams, secrets *SecretsBundle) ([]byte, error) {
	if params.Role != "controlplane" && params.Role != "worker" {
		return nil, fmt.Errorf("invalid role %q, must be controlplane or worker", params.Role)
	}
	if params.Endpoint == "" {
		return nil, fmt.Errorf("control plane endpoint is required")
	}

	installImage := fmt.Sprintf("factory.talos.dev/installer/%s/%s",
		params.TalosSchematic, params.TalosVersion)
	osDisk := params.OSDisk
	if osDisk == "" {
		osDisk = defaultOSDisk
	}

	config := map[string]any{
		"version": "v1alpha1",
		"persist": true,
		"machine": buildMachineSection(params, secrets, installImage, osDisk),
		"cluster": buildClusterSection(params, secrets),
	}

	return yaml.Marshal(config)
}

func buildMachineSection(params MachineConfigParams, secrets *SecretsBundle, installImage, osDisk string) map[string]any {
	machine := map[string]any{
		"type":  params.Role,
		"token": secrets.MachineToken,
		"ca": map[string]any{
			"crt": secrets.MachineCA,
			"key": secrets.MachineCAKey,
		},
		"install": map[string]any{
			"disk":  osDisk,
			"image": installImage,
			"wipe":  false,
			"bootloader": map[string]any{
				"type": "uki",
			},
		},
		"kubelet": map[string]any{
			"image": fmt.Sprintf("ghcr.io/siderolabs/kubelet:%s", params.KubernetesVersion),
			"extraConfig": map[string]any{
				"seccompDefault": true,
			},
		},
		"features": map[string]any{
			"diskQuotaSupport": true,
			"kubePrism": map[string]any{
				"enabled": true,
				"port":    7445,
			},
			"hostDNS": map[string]any{
				"enabled":              true,
				"forwardKubeDNSToHost": true,
			},
		},
	}

	if params.Role == "worker" {
		// Workers don't need the CA key
		machine["ca"] = map[string]any{
			"crt": secrets.MachineCA,
		}
	}

	return machine
}

func buildClusterSection(params MachineConfigParams, secrets *SecretsBundle) map[string]any {
	cluster := map[string]any{
		"id":     secrets.ClusterSecret,
		"secret": secrets.ClusterSecret,
		"controlPlane": map[string]any{
			"endpoint": fmt.Sprintf("https://%s:6443", params.Endpoint),
		},
		"clusterName": params.ClusterName,
		"network": map[string]any{
			"cni": map[string]any{
				"name": "none", // Cilium installed post-bootstrap
			},
			"podSubnets":     []string{"10.244.0.0/16"},
			"serviceSubnets": []string{"10.96.0.0/12"},
		},
		"token": secrets.BootstrapToken,
		"ca": map[string]any{
			"crt": secrets.ClusterCA,
			"key": secrets.ClusterCAKey,
		},
		"etcd": map[string]any{
			"ca": map[string]any{
				"crt": secrets.EtcdCA,
				"key": secrets.EtcdCAKey,
			},
		},
		"discovery": map[string]any{
			"enabled": true,
			"registries": map[string]any{
				"kubernetes": map[string]any{
					"disabled": true,
				},
				"service": map[string]any{},
			},
		},
		"proxy": map[string]any{
			"disabled": true, // KubePrism replaces kube-proxy
		},
	}

	if params.Role == "controlplane" {
		cluster["allowSchedulingOnControlPlanes"] = true

		kubeletVersion := strings.TrimPrefix(params.KubernetesVersion, "v")
		_ = kubeletVersion

		cluster["apiServer"] = map[string]any{
			"image": fmt.Sprintf("registry.k8s.io/kube-apiserver:%s", params.KubernetesVersion),
			"admissionControl": []map[string]any{
				{
					"name": "PodSecurity",
					"configuration": map[string]any{
						"apiVersion": "pod-security.admission.config.k8s.io/v1",
						"kind":       "PodSecurityConfiguration",
						"defaults": map[string]any{
							"enforce":        "baseline",
							"enforce-version": "latest",
							"audit":          "restricted",
							"audit-version":  "latest",
							"warn":           "restricted",
							"warn-version":   "latest",
						},
						"exemptions": map[string]any{
							"namespaces": []string{"kube-system"},
						},
					},
				},
			},
		}
		cluster["controllerManager"] = map[string]any{
			"image": fmt.Sprintf("registry.k8s.io/kube-controller-manager:%s", params.KubernetesVersion),
		}
		cluster["scheduler"] = map[string]any{
			"image": fmt.Sprintf("registry.k8s.io/kube-scheduler:%s", params.KubernetesVersion),
		}
	}

	return cluster
}

// GenerateTalosconfig builds a talosconfig YAML for client access to the cluster.
func GenerateTalosconfig(clusterName string, secrets *SecretsBundle, endpoints []string) ([]byte, error) {
	config := map[string]any{
		"context": clusterName,
		"contexts": map[string]any{
			clusterName: map[string]any{
				"endpoints": endpoints,
				"ca":        secrets.TalosCA,
				"crt":       secrets.TalosCA,
				"key":       secrets.TalosCAKey,
			},
		},
	}

	return yaml.Marshal(config)
}
