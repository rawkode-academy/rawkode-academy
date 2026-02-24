package cluster

import (
	"fmt"
)

// DriftResult describes differences between desired and actual cluster state.
type DriftResult struct {
	MissingNodes []string // Nodes in state but not in Scaleway
	ExtraNodes   []string // Nodes in Scaleway but not in state
	IPMismatches []IPMismatch
}

// IPMismatch describes a node whose actual IP doesn't match state.
type IPMismatch struct {
	NodeName string
	Expected string
	Actual   string
}

// HasDrift returns true if any differences were detected.
func (d *DriftResult) HasDrift() bool {
	return len(d.MissingNodes) > 0 || len(d.ExtraNodes) > 0 || len(d.IPMismatches) > 0
}

// String returns a human-readable summary of drift.
func (d *DriftResult) String() string {
	if !d.HasDrift() {
		return "No drift detected."
	}
	result := "Drift detected:\n"
	for _, n := range d.MissingNodes {
		result += fmt.Sprintf("  - Missing node: %s\n", n)
	}
	for _, n := range d.ExtraNodes {
		result += fmt.Sprintf("  - Extra node: %s\n", n)
	}
	for _, m := range d.IPMismatches {
		result += fmt.Sprintf("  - IP mismatch for %s: expected %s, got %s\n", m.NodeName, m.Expected, m.Actual)
	}
	return result
}

// DetectDrift compares known node state against actual Scaleway servers.
func DetectDrift(knownNodes []NodeState, actualNodes map[string]string) *DriftResult {
	result := &DriftResult{}

	knownMap := make(map[string]string, len(knownNodes))
	for _, node := range knownNodes {
		knownMap[node.Name] = node.PublicIP
	}

	for name, expectedIP := range knownMap {
		actualIP, exists := actualNodes[name]
		if !exists {
			result.MissingNodes = append(result.MissingNodes, name)
			continue
		}
		if expectedIP != "" && actualIP != expectedIP {
			result.IPMismatches = append(result.IPMismatches, IPMismatch{
				NodeName: name,
				Expected: expectedIP,
				Actual:   actualIP,
			})
		}
	}

	for name := range actualNodes {
		if _, exists := knownMap[name]; !exists {
			result.ExtraNodes = append(result.ExtraNodes, name)
		}
	}

	return result
}
