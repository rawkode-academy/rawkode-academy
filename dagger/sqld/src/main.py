import dagger
from dagger import dag, function


@function
def sqld(bind: int = 8080) -> dagger.Service:
    return (
        dag.container(platform=dagger.Platform("linux/amd64"))
        .from_("ghcr.io/tursodatabase/libsql-server:latest")
        .with_exposed_port(8080)
        .with_env_variable("SQLD_HTTP_LISTEN_ADDR", f"0.0.0.0:{bind}")
        .with_exec(["/bin/sqld"])
        .as_service()
    )
