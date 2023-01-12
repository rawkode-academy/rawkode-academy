# AWS Control Plane

This Pulumi program is responsible for setting up all the building blocks to host Rawkode Academy projects.

This program cannot be run by automation, as it requires the AWS root credentials.

As such, it should be executed locally by me.

```shell
pnpm exec dagger deploy -L
```
