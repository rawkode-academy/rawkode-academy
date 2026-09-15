# Prepended to every scenario script. Runs as root on the control-plane node.
# Keep it POSIX-ish bash with no dependencies beyond coreutils and kubectl:
# kind node images ship neither curl nor wget.
export KUBECONFIG="${KUBECONFIG:-/etc/kubernetes/admin.conf}"
export KB_NS="${KB_NS:-default}"

kb_node_ip() {
	kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'
}

# kb_http_get HOST PORT [PATH] - plain HTTP/1.0 GET over bash's /dev/tcp.
kb_http_get() {
	local host="$1" port="$2" path="${3:-/}"
	timeout 15 bash -c '
		exec 3<>"/dev/tcp/$0/$1" || exit 1
		printf "GET %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n\r\n" "$2" "$0" >&3
		cat <&3
	' "$host" "$port" "$path"
}

# kb_wait SECONDS CMD... - retry CMD until it exits 0 or SECONDS elapse.
kb_wait() {
	local deadline=$(( $(date +%s) + $1 )); shift
	until "$@" >/dev/null 2>&1; do
		if [ "$(date +%s)" -ge "$deadline" ]; then
			echo "kb_wait: timed out waiting for: $*" >&2
			return 1
		fi
		sleep 2
	done
}

# kb_app_ok [v2] - the klustered app answers on NodePort 30000 with a seeded
# quote and no database error. With "v2" it must also be serving the v2 image.
kb_app_ok() {
	local want="${1:-}" ip resp
	ip="$(kb_node_ip)" || return 1
	resp="$(kb_http_get "$ip" 30000 /)" || return 1
	if [ "$want" = "v2" ] && ! printf '%s' "$resp" | grep -q "v2"; then
		echo "app is up but not serving v2" >&2
		return 1
	fi
	printf '%s' "$resp" | grep -Eq "Stephen Augustus|Duffie|Katy Farmer|May your bag|Fight for your limits|Productivity does not determine your value" || {
		echo "app responded without a seeded quote" >&2
		return 1
	}
	if printf '%s' "$resp" | grep -Eqi "Failed to connect to database|error connecting|Name or service not known"; then
		echo "app is up but cannot reach its database" >&2
		return 1
	fi
	return 0
}

kb_app_pod() {
	kubectl -n "$KB_NS" get pod -l app=klustered -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

export -f kb_node_ip kb_http_get kb_wait kb_app_ok kb_app_pod
