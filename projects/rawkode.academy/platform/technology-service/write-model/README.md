---
runme:
  id: 01J7P6GRV1KBT48QP2ZK41WTC7
  version: v3
shell: bash
---

# Technology Service

## Write Model

```sh {"id":"01J7P7V7VTFG8MVFHQQKHSR0FD","interactive":"false","name":"Setup","promptEnv":"yes"}

```

```sh {"id":"01J7P7VBYXRFVG6BJHB0FAVDYF"}
bunx @restatedev/restate invocations list
```

### Testing

You'll need to set `RPC_HOST` before running the command.

```sh {"id":"01J7P6HHGG2NMTRKZ1CJ1NW2PM","promptEnv":"yes"}
export RESTATE_URL="http://localhost:8080"
export RESTATE_TOKEN=""

curl -v -H "Authorization: Bearer $RESTATE_TOKEN" -H "Content-type: application/json" -XPOST --data "@test" $RESTATE_URL/technology/create
```

```sh {"id":"01J7P78NND2FQM4X6YDAYH667J"}
echo hello
```
