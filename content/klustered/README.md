# Klustered

## Episode Description Format

Use "rich" markdown (GitHub Flavoured) as much as possible. While we'll strip this out for YouTube, it'll be useful for the website.

```hcl
links = [
  "https://google.com"
]

description = <<-EOF
  SUMMARY

  LESSONS LEARNED

  USEFUL COMMANDS

  ALL THE BREAKS
EOF
```

### SUMMARY (Example)

This episode of Klustered features two fanastic teams from titans of the Kubernetes community: Google and Amazon.

During this episode, we seen our two teams battle with API server flags, broken Kubelet configurations, and some rather sneaky networking shenanigans on the kernel.

### LESSONS LEARNED (Example)

- There's a piece of Linux software called trafficcontrol (`tc`) that can be used to simulate network latency and packet loss. It's a great tool for testing network resiliency.
- The kubetlet really doesn't like it when you change the cgroup implementation
- The API server can be configured to not run the individual controllers, such as the Deployment controller.

### Useful Commands (Example)

You can add a delay to packets with tc:
`tc qdisc add dev eth0 root netem delay 100ms 10ms distribution normal`

NEXT
`SOME COMMAND`

### ALL THE BREAKS (Example)

Disabling Individual Controllers on the API Server

The API server is configured via a static manifest. In this manifest is a flag called "controllers". You can disable a controller by prefixing its name with a "-"

To fix this problem, the fixers had to remove the misconfiguration from the controllers list.

---

NEXT BREAK TITLE (Short sentence)

NEXT BREAK SUMMARY (2-3 Sentences)

NEXT BREAK SOLUTION (Short sentence)

### Other Notes

- Any useful links from the episode, or to software used/mentioned, should be added to the links array.

### WIP

- [ ] Guests?
- [ ] Teams?
- [ ] Chapters?
