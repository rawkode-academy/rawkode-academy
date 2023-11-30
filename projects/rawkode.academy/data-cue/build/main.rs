use dagger_sdk::HostDirectoryOpts;
use std::fs;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let client = dagger_sdk::connect().await?;

    let source_path = fs::canonicalize(file!()).unwrap();

    let source_dir = client.host().directory_opts(
        source_path.parent().unwrap().parent().unwrap().to_str().unwrap(),
        HostDirectoryOpts {
            exclude: Some(vec!["build".into(), "pkgx.yaml".into()]),
            include: None,
        },
    );

    let json = client
        .container()
        .from("cuelang/cue:0.6.0")
        .with_mounted_directory("/src", source_dir)
        .with_workdir("/src")
        .with_entrypoint(vec!["cue"])
        .with_exec(vec!["export"])
        .stdout()
        .await?;

    println!("{}", json.trim());

    Ok(())
}
