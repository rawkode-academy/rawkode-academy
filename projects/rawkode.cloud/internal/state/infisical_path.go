package state

import "strings"

func normalizeSecretPath(path string) string {
	clean := strings.TrimSpace(path)
	if clean == "" {
		return "/"
	}

	if !strings.HasPrefix(clean, "/") {
		clean = "/" + clean
	}

	for strings.Contains(clean, "//") {
		clean = strings.ReplaceAll(clean, "//", "/")
	}

	if clean != "/" {
		clean = strings.TrimSuffix(clean, "/")
	}

	return clean
}

func clusterSecretPath(basePath, clusterName string) string {
	base := normalizeSecretPath(basePath)
	cluster := strings.Trim(strings.TrimSpace(clusterName), "/")
	if cluster == "" {
		return base
	}

	trimmedBase := strings.Trim(base, "/")
	if trimmedBase != "" {
		segments := strings.Split(trimmedBase, "/")
		if segments[len(segments)-1] == cluster {
			return base
		}
	}

	if base == "/" {
		return "/" + cluster
	}

	return base + "/" + cluster
}
