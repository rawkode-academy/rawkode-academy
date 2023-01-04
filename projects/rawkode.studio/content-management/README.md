# Content Management

## Data

The data resides in [data](data). The data is split into four directories:

* [Episodes](data/episodes/)
* [People](data/people/)
* [Shows](data/shows/)
* [Technologies](data/technologies/)

The data exists to feed the YouTube channel of [Rawkode Academy](https://www.youtube.com/c/rawkode).

## CLI

### Linter

The file linter is part of the [CLI](cli). When a file is valid, it exits with a status code of 0. When a file is invalid, it exits with a status code of 1 and prints the errors to standard error.

Supported file formats (links to their respective directories including examples):

* [Episodes](data/episodes/)
* [People](data/people/)
* [Shows](data/shows/)
* [Technologies](data/technologies/)

#### Usage (linter)

To run the linter, use the following command:

```shell
cargo run --manifest-path=cli/Cargo.toml -- lint --path data/episodes/
```

To format all files, use the following command:

```shell
cargo run --manifest-path=cli/Cargo.toml -- format --path data/ [--apply]
```

### Sync

The sync tool is part of the [CLI](cli). It syncs the data with the YouTube channel of [Rawkode Academy](https://www.youtube.com/c/rawkode).

#### Usage (sync)

To run the sync, use the following command:

```shell
export POSTGRESQL_CONNECTION_STRING="postgres://academy:academy@localhost:5432/academy" # or something else
cargo run --manifest-path=cli/Cargo.toml -- sync --path data/ [--apply]
```

## Local testing

```shell
cd cli
docker-compose up

cargo run --manifest-path=cli/Cargo.toml -- sync --path data/ --apply
```
