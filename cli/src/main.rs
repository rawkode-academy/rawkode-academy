use crate::cli::Cli;
use clap::Parser;
use miette::Result;

mod cli;
mod command;
mod model;

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.subcommand {
        cli::SubCommand::Format(cli::Format { path, apply }) => command::format(path, apply),
        cli::SubCommand::Lint(cli::Lint { path }) => command::lint(path),
        cli::SubCommand::Sync(cli::Sync { path, apply }) => command::sync(path, apply),
    }
}
