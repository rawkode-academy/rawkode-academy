use crate::cli::Cli;
use clap::Parser;
use miette::Result;

mod cli;
mod format;
mod lint;
mod model;
mod sync;
mod utils;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.subcommand {
        cli::SubCommand::Format(cli::Format { path, apply }) => format::command(path, apply),
        cli::SubCommand::Lint(cli::Lint { path }) => lint::command(path),
        cli::SubCommand::Sync(cli::Sync { path, apply }) => sync::command(path, apply).await,
    }
}
