# Content Management

## Linter

The episode file linter resides in [linter](linter). When an episode file is valid, it exits with a status code of 0. When an episode file is invalid, it exits with a status code of 1 and prints the errors to standard error.

A sample episode file is provided via [sample_episode.hcl](linter/sample_episode.hcl).

```shell
cargo run --manifest-path=linter/Cargo.toml -- linter/sample_episode.hcl
```
