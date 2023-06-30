import (
	"strings"
)

resource: scaleway_instance_server: [string]: {
	image:             strings.HasPrefix("ubuntu")
	enable_dynamic_ip: true
}
